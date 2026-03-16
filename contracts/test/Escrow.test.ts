import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Escrow", function () {
  const DISPUTE_WINDOW = 86400; // 24 hours
  const FEE_BPS = 250; // 2.5%
  const DEAL_ID = ethers.id("deal-001");
  const TERMS_HASH = "QmTestTermsHash123";
  const ONE_ETH = ethers.parseEther("1.0");

  async function deployFixture() {
    const [arbiter, brand, creator, other] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    // feeRecipient = arbiter for simplicity in tests
    const escrow = await Escrow.deploy(arbiter.address, DISPUTE_WINDOW, FEE_BPS, arbiter.address);
    const deadline = (await time.latest()) + 7 * 86400; // 7 days from now
    return { escrow, arbiter, brand, creator, other, deadline };
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

  // ── createDeal ──────────────────────────────────────

  it("should create a deal with ETH deposit", async function () {
    const { escrow, brand, creator, deadline } = await loadFixture(deployFixture);
    await expect(
      escrow.connect(brand).createDeal(DEAL_ID, creator.address, deadline, TERMS_HASH, {
        value: ONE_ETH,
      })
    )
      .to.emit(escrow, "DealCreated")
      .withArgs(DEAL_ID, brand.address, creator.address, ONE_ETH, TERMS_HASH);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.brand).to.equal(brand.address);
    expect(deal.creator).to.equal(creator.address);
    expect(deal.amount).to.equal(ONE_ETH);
    expect(deal.status).to.equal(0); // Created
  });

  it("should reject duplicate deal ID", async function () {
    const { escrow, brand, creator, deadline } = await loadFixture(fundedDealFixture);
    await expect(
      escrow.connect(brand).createDeal(DEAL_ID, creator.address, deadline, TERMS_HASH, {
        value: ONE_ETH,
      })
    ).to.be.revertedWith("Deal already exists");
  });

  it("should reject zero deposit", async function () {
    const { escrow, brand, creator, deadline } = await loadFixture(deployFixture);
    await expect(
      escrow.connect(brand).createDeal(DEAL_ID, creator.address, deadline, TERMS_HASH, {
        value: 0,
      })
    ).to.be.revertedWith("Must deposit ETH");
  });

  // ── submitDelivery ──────────────────────────────────

  it("should allow creator to submit delivery", async function () {
    const { escrow, creator } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(creator).submitDelivery(DEAL_ID))
      .to.emit(escrow, "DeliverySubmitted")
      .withArgs(DEAL_ID);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(1); // DeliverySubmitted
    expect(deal.disputeWindowEnd).to.be.greaterThan(0);
  });

  it("should reject delivery from unauthorized caller", async function () {
    const { escrow, other } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(other).submitDelivery(DEAL_ID)).to.be.revertedWith(
      "Not authorized"
    );
  });

  // ── dispute ─────────────────────────────────────────

  it("should allow brand to dispute during window", async function () {
    const { escrow, brand } = await loadFixture(deliverySubmittedFixture);
    await expect(escrow.connect(brand).dispute(DEAL_ID))
      .to.emit(escrow, "DisputeRaised")
      .withArgs(DEAL_ID);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(2); // Disputed
  });

  it("should reject dispute after window closes", async function () {
    const { escrow, brand } = await loadFixture(deliverySubmittedFixture);
    await time.increase(DISPUTE_WINDOW + 1);
    await expect(escrow.connect(brand).dispute(DEAL_ID)).to.be.revertedWith(
      "Dispute window closed"
    );
  });

  it("should reject dispute from non-brand", async function () {
    const { escrow, creator } = await loadFixture(deliverySubmittedFixture);
    await expect(escrow.connect(creator).dispute(DEAL_ID)).to.be.revertedWith(
      "Only brand can dispute"
    );
  });

  // ── autoRelease (the key mechanic) — with fee ─────

  it("should auto-release after dispute window — silence = release — with fee deducted", async function () {
    const { escrow, arbiter, creator, other } = await loadFixture(deliverySubmittedFixture);
    const creatorBefore = await ethers.provider.getBalance(creator.address);
    const arbiterBefore = await ethers.provider.getBalance(arbiter.address);

    await time.increase(DISPUTE_WINDOW + 1);

    // Fee: 2.5% of 1 ETH = 0.025 ETH. Creator gets 0.975 ETH.
    const expectedFee = ONE_ETH * BigInt(FEE_BPS) / 10000n;
    const expectedNet = ONE_ETH - expectedFee;

    // Call from `other` so arbiter's balance isn't affected by gas
    await expect(escrow.connect(other).autoRelease(DEAL_ID))
      .to.emit(escrow, "DealCompleted")
      .withArgs(DEAL_ID, creator.address, expectedNet)
      .to.emit(escrow, "FeeCollected")
      .withArgs(DEAL_ID, expectedFee);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(3); // Completed

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    expect(creatorAfter - creatorBefore).to.equal(expectedNet);

    // Fee recipient (arbiter) got the fee — no gas deducted since `other` called
    const arbiterAfter = await ethers.provider.getBalance(arbiter.address);
    expect(arbiterAfter - arbiterBefore).to.equal(expectedFee);

    // totalFeesCollected updated
    expect(await escrow.totalFeesCollected()).to.equal(expectedFee);
  });

  it("should reject autoRelease before window closes", async function () {
    const { escrow } = await loadFixture(deliverySubmittedFixture);
    await expect(escrow.autoRelease(DEAL_ID)).to.be.revertedWith("Window still open");
  });

  // ── release (arbiter) — with fee ──────────────────

  it("should allow arbiter to release funds with fee deducted", async function () {
    const { escrow, arbiter, creator } = await loadFixture(fundedDealFixture);
    const expectedFee = ONE_ETH * BigInt(FEE_BPS) / 10000n;
    const expectedNet = ONE_ETH - expectedFee;

    await expect(escrow.connect(arbiter).release(DEAL_ID))
      .to.emit(escrow, "DealCompleted")
      .withArgs(DEAL_ID, creator.address, expectedNet)
      .to.emit(escrow, "FeeCollected")
      .withArgs(DEAL_ID, expectedFee);
  });

  it("should reject release from non-arbiter", async function () {
    const { escrow, brand } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(brand).release(DEAL_ID)).to.be.revertedWith("Only arbiter");
  });

  // ── refund (arbiter) — NO fee ─────────────────────

  it("should allow arbiter to refund brand — no fee charged", async function () {
    const { escrow, arbiter, brand } = await loadFixture(fundedDealFixture);
    const brandBefore = await ethers.provider.getBalance(brand.address);

    await expect(escrow.connect(arbiter).refund(DEAL_ID))
      .to.emit(escrow, "DealRefunded")
      .withArgs(DEAL_ID, brand.address, ONE_ETH);

    // Brand gets full amount back — no fee
    const brandAfter = await ethers.provider.getBalance(brand.address);
    expect(brandAfter - brandBefore).to.equal(ONE_ETH);

    // No fees collected
    expect(await escrow.totalFeesCollected()).to.equal(0);
  });

  // ── rule (dispute resolution) — fee on creator share only ─

  it("should split funds per ruling — 70/30 — fee on creator share only", async function () {
    const { escrow, arbiter, brand, creator } = await loadFixture(deliverySubmittedFixture);
    await escrow.connect(brand).dispute(DEAL_ID);

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    const brandBefore = await ethers.provider.getBalance(brand.address);

    // 7000 bps = 70% to creator = 0.7 ETH gross
    const creatorGross = ethers.parseEther("0.7");
    const expectedFee = creatorGross * BigInt(FEE_BPS) / 10000n;
    const creatorNet = creatorGross - expectedFee;
    const brandShare = ethers.parseEther("0.3");

    await expect(escrow.connect(arbiter).rule(DEAL_ID, 7000))
      .to.emit(escrow, "DisputeRuled")
      .withArgs(DEAL_ID, creatorNet, brandShare)
      .to.emit(escrow, "FeeCollected")
      .withArgs(DEAL_ID, expectedFee);

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    const brandAfter = await ethers.provider.getBalance(brand.address);

    expect(creatorAfter - creatorBefore).to.equal(creatorNet);
    expect(brandAfter - brandBefore).to.equal(brandShare);
  });

  it("should rule 100% to creator (full release) — fee deducted", async function () {
    const { escrow, arbiter, brand, creator } = await loadFixture(deliverySubmittedFixture);
    await escrow.connect(brand).dispute(DEAL_ID);

    const expectedFee = ONE_ETH * BigInt(FEE_BPS) / 10000n;

    await expect(escrow.connect(arbiter).rule(DEAL_ID, 10000))
      .to.emit(escrow, "FeeCollected")
      .withArgs(DEAL_ID, expectedFee);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(3); // Completed
  });

  it("should rule 0% to creator (full refund) — no fee", async function () {
    const { escrow, arbiter, brand, creator } = await loadFixture(deliverySubmittedFixture);
    await escrow.connect(brand).dispute(DEAL_ID);

    const brandBefore = await ethers.provider.getBalance(brand.address);
    await escrow.connect(arbiter).rule(DEAL_ID, 0);

    const brandAfter = await ethers.provider.getBalance(brand.address);
    expect(brandAfter - brandBefore).to.equal(ONE_ETH);

    // No fee when creator gets nothing
    expect(await escrow.totalFeesCollected()).to.equal(0);
  });

  // ── cancelDeal — NO fee ───────────────────────────

  it("should allow brand to cancel before delivery — no fee", async function () {
    const { escrow, brand } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(brand).cancelDeal(DEAL_ID))
      .to.emit(escrow, "DealCancelled")
      .withArgs(DEAL_ID);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(5); // Cancelled
    expect(await escrow.totalFeesCollected()).to.equal(0);
  });

  it("should reject cancel from non-brand", async function () {
    const { escrow, creator } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(creator).cancelDeal(DEAL_ID)).to.be.revertedWith(
      "Only brand can cancel"
    );
  });

  // ── Fee management ────────────────────────────────

  it("should allow arbiter to update fee", async function () {
    const { escrow, arbiter } = await loadFixture(deployFixture);
    await expect(escrow.connect(arbiter).setFeeBps(500))
      .to.emit(escrow, "FeeUpdated")
      .withArgs(FEE_BPS, 500);
    expect(await escrow.feeBps()).to.equal(500);
  });

  it("should reject fee above 10%", async function () {
    const { escrow, arbiter } = await loadFixture(deployFixture);
    await expect(escrow.connect(arbiter).setFeeBps(1001)).to.be.revertedWith("Fee too high");
  });

  it("should reject fee update from non-arbiter", async function () {
    const { escrow, brand } = await loadFixture(deployFixture);
    await expect(escrow.connect(brand).setFeeBps(500)).to.be.revertedWith("Only arbiter");
  });

  it("should allow arbiter to update fee recipient", async function () {
    const { escrow, arbiter, other } = await loadFixture(deployFixture);
    await expect(escrow.connect(arbiter).setFeeRecipient(other.address))
      .to.emit(escrow, "FeeRecipientUpdated")
      .withArgs(arbiter.address, other.address);
    expect(await escrow.feeRecipient()).to.equal(other.address);
  });
});
