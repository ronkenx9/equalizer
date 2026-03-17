import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("YieldEscrow", function () {
  const DISPUTE_WINDOW = 86400;
  const FEE_BPS = 250; // 2.5%
  const DEAL_ID = ethers.id("yield-deal-001");
  const TERMS_HASH = "QmYieldTestTerms";
  const ONE_ETH = ethers.parseEther("1.0");

  async function deployFixture() {
    const [arbiter, brand, creator, other] = await ethers.getSigners();

    // Deploy MockWstETH
    const MockWstETH = await ethers.getContractFactory("MockWstETH");
    const wstETH = await MockWstETH.deploy();

    // Fund MockWstETH so it can pay out simulated yield
    await arbiter.sendTransaction({
      to: await wstETH.getAddress(),
      value: ethers.parseEther("10.0")
    });

    // Deploy YieldEscrow
    const YieldEscrow = await ethers.getContractFactory("YieldEscrow");
    const escrow = await YieldEscrow.deploy(
      arbiter.address,
      await wstETH.getAddress(),
      DISPUTE_WINDOW,
      FEE_BPS,
      arbiter.address
    );

    const deadline = (await time.latest()) + 7 * 86400;
    return { escrow, wstETH, arbiter, brand, creator, other, deadline };
  }

  async function fundedDealFixture() {
    const fixture = await deployFixture();
    const { escrow, brand, creator, deadline } = fixture;
    await escrow.connect(brand).createDeal(DEAL_ID, creator.address, deadline, TERMS_HASH, {
      value: ONE_ETH,
    });
    return fixture;
  }

  async function deliverySubmittedFixture() {
    const fixture = await fundedDealFixture();
    const { escrow, creator } = fixture;
    await escrow.connect(creator).submitDelivery(DEAL_ID);
    return fixture;
  }

  async function disputedFixture() {
    const fixture = await deliverySubmittedFixture();
    const { escrow, brand } = fixture;
    await escrow.connect(brand).dispute(DEAL_ID);
    return fixture;
  }

  // ── createDeal (ETH wrapped to wstETH) ──────────────

  it("should create a deal and wrap ETH to wstETH", async function () {
    const { escrow, wstETH, brand, creator, deadline } = await loadFixture(deployFixture);

    await escrow.connect(brand).createDeal(DEAL_ID, creator.address, deadline, TERMS_HASH, {
      value: ONE_ETH,
    });

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.brand).to.equal(brand.address);
    expect(deal.creator).to.equal(creator.address);
    expect(deal.originalAmount).to.equal(ONE_ETH);
    expect(deal.wstETHAmount).to.equal(ONE_ETH); // 1:1 at initial rate
    expect(deal.status).to.equal(0); // Created

    // wstETH should be held by the escrow contract
    const escrowAddr = await escrow.getAddress();
    expect(await wstETH.balanceOf(escrowAddr)).to.equal(ONE_ETH);
  });

  it("should reject duplicate deal ID", async function () {
    const { escrow, brand, creator, deadline } = await loadFixture(fundedDealFixture);
    await expect(
      escrow.connect(brand).createDeal(DEAL_ID, creator.address, deadline, TERMS_HASH, { value: ONE_ETH })
    ).to.be.revertedWith("Deal already exists");
  });

  // ── release (no yield) ────────────────────────────────

  it("should release to creator with fee deducted (no yield)", async function () {
    const { escrow, arbiter, creator } = await loadFixture(fundedDealFixture);

    const balBefore = await ethers.provider.getBalance(creator.address);
    await escrow.connect(arbiter).release(DEAL_ID);
    const balAfter = await ethers.provider.getBalance(creator.address);

    // Creator gets 1 ETH minus 2.5% fee = 0.975 ETH
    const expected = ethers.parseEther("0.975");
    expect(balAfter - balBefore).to.equal(expected);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(3); // Completed
  });

  // ── release WITH yield ────────────────────────────────

  it("should harvest yield on release — creator gets principal, treasury gets yield", async function () {
    const { escrow, wstETH, arbiter, creator } = await loadFixture(fundedDealFixture);

    // Simulate 5% yield: 1 wstETH now worth 1.05 ETH
    await wstETH.simulateYield(ethers.parseEther("1.05"));

    const treasuryBefore = await ethers.provider.getBalance(arbiter.address);
    const creatorBefore = await ethers.provider.getBalance(creator.address);

    const tx = await escrow.connect(arbiter).release(DEAL_ID);
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    const treasuryAfter = await ethers.provider.getBalance(arbiter.address);

    // Creator gets 1 ETH - 2.5% fee = 0.975 ETH (principal only)
    expect(creatorAfter - creatorBefore).to.equal(ethers.parseEther("0.975"));

    // Treasury gets: yield (0.05 ETH) + fee (0.025 ETH) - gas
    // Net treasury change = 0.075 ETH - gas
    const treasuryGain = treasuryAfter - treasuryBefore + gasUsed;
    expect(treasuryGain).to.equal(ethers.parseEther("0.075"));

    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.05"));
  });

  // ── refund WITH yield ─────────────────────────────────

  it("should refund brand full principal (no fee), yield to treasury", async function () {
    const { escrow, wstETH, arbiter, brand } = await loadFixture(fundedDealFixture);

    // Simulate 3% yield
    await wstETH.simulateYield(ethers.parseEther("1.03"));

    const brandBefore = await ethers.provider.getBalance(brand.address);
    await escrow.connect(arbiter).refund(DEAL_ID);
    const brandAfter = await ethers.provider.getBalance(brand.address);

    // Brand gets full 1 ETH refund (no fee on refunds)
    expect(brandAfter - brandBefore).to.equal(ONE_ETH);

    // Yield tracked
    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.03"));
  });

  // ── auto-release after window ─────────────────────────

  it("should auto-release after dispute window with yield harvested", async function () {
    const { escrow, wstETH, creator } = await loadFixture(deliverySubmittedFixture);

    // Simulate 2% yield
    await wstETH.simulateYield(ethers.parseEther("1.02"));

    // Fast-forward past dispute window
    await time.increase(DISPUTE_WINDOW + 1);

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    await escrow.autoRelease(DEAL_ID);
    const creatorAfter = await ethers.provider.getBalance(creator.address);

    // Creator gets principal minus fee: 1 ETH - 2.5% = 0.975 ETH
    expect(creatorAfter - creatorBefore).to.equal(ethers.parseEther("0.975"));
    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.02"));
  });

  it("should reject auto-release before window closes", async function () {
    const { escrow } = await loadFixture(deliverySubmittedFixture);
    await expect(escrow.autoRelease(DEAL_ID)).to.be.revertedWith("Window still open");
  });

  // ── dispute + rule with yield ─────────────────────────

  it("should split funds on dispute ruling with yield harvested", async function () {
    const { escrow, wstETH, arbiter, brand, creator } = await loadFixture(disputedFixture);

    // Simulate 4% yield
    await wstETH.simulateYield(ethers.parseEther("1.04"));

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    const brandBefore = await ethers.provider.getBalance(brand.address);

    // Rule: 70% to creator, 30% to brand
    await escrow.connect(arbiter).rule(DEAL_ID, 7000);

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    const brandAfter = await ethers.provider.getBalance(brand.address);

    // Creator gets 70% of 1 ETH = 0.7 ETH minus 2.5% fee = 0.6825 ETH
    expect(creatorAfter - creatorBefore).to.equal(ethers.parseEther("0.6825"));
    // Brand gets 30% of 1 ETH = 0.3 ETH (no fee on refund portion)
    expect(brandAfter - brandBefore).to.equal(ethers.parseEther("0.3"));

    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.04"));
  });

  it("should rule 100% to creator with yield", async function () {
    const { escrow, wstETH, arbiter, creator } = await loadFixture(disputedFixture);

    await wstETH.simulateYield(ethers.parseEther("1.01"));

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    await escrow.connect(arbiter).rule(DEAL_ID, 10000);
    const creatorAfter = await ethers.provider.getBalance(creator.address);

    expect(creatorAfter - creatorBefore).to.equal(ethers.parseEther("0.975"));
    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.01"));
  });

  it("should rule 0% to creator (full refund) with yield", async function () {
    const { escrow, wstETH, arbiter, brand } = await loadFixture(disputedFixture);

    await wstETH.simulateYield(ethers.parseEther("1.02"));

    const brandBefore = await ethers.provider.getBalance(brand.address);
    await escrow.connect(arbiter).rule(DEAL_ID, 0);
    const brandAfter = await ethers.provider.getBalance(brand.address);

    // Brand gets full 1 ETH (no fee when creator gets 0%)
    expect(brandAfter - brandBefore).to.equal(ONE_ETH);
    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.02"));
  });

  // ── cancel with yield ─────────────────────────────────

  it("should cancel deal and return principal, yield to treasury", async function () {
    const { escrow, wstETH, brand } = await loadFixture(fundedDealFixture);

    await wstETH.simulateYield(ethers.parseEther("1.01"));

    const brandBefore = await ethers.provider.getBalance(brand.address);
    const tx = await escrow.connect(brand).cancelDeal(DEAL_ID);
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const brandAfter = await ethers.provider.getBalance(brand.address);

    // Brand gets full principal back (no fee on cancel)
    expect(brandAfter - brandBefore + gasUsed).to.equal(ONE_ETH);
    expect(await escrow.totalYieldEarned()).to.equal(ethers.parseEther("0.01"));
  });

  // ── access control ────────────────────────────────────

  it("should reject release from non-arbiter", async function () {
    const { escrow, brand } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(brand).release(DEAL_ID)).to.be.revertedWith("Only arbiter");
  });

  it("should reject dispute from non-brand", async function () {
    const { escrow, creator } = await loadFixture(deliverySubmittedFixture);
    await expect(escrow.connect(creator).dispute(DEAL_ID)).to.be.revertedWith("Only brand can dispute");
  });
});
