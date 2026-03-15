import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Escrow", function () {
  const DISPUTE_WINDOW = 86400; // 24 hours
  const DEAL_ID = ethers.id("deal-001");
  const TERMS_HASH = "QmTestTermsHash123";
  const ONE_ETH = ethers.parseEther("1.0");

  async function deployFixture() {
    const [arbiter, brand, creator, other] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(arbiter.address, DISPUTE_WINDOW);
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

  // ── autoRelease (the key mechanic) ──────────────────

  it("should auto-release after dispute window — silence = release", async function () {
    const { escrow, creator } = await loadFixture(deliverySubmittedFixture);
    const creatorBefore = await ethers.provider.getBalance(creator.address);

    await time.increase(DISPUTE_WINDOW + 1);

    await expect(escrow.autoRelease(DEAL_ID))
      .to.emit(escrow, "DealCompleted")
      .withArgs(DEAL_ID, creator.address, ONE_ETH);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(3); // Completed

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    expect(creatorAfter - creatorBefore).to.equal(ONE_ETH);
  });

  it("should reject autoRelease before window closes", async function () {
    const { escrow } = await loadFixture(deliverySubmittedFixture);
    await expect(escrow.autoRelease(DEAL_ID)).to.be.revertedWith("Window still open");
  });

  // ── release (arbiter) ───────────────────────────────

  it("should allow arbiter to release funds", async function () {
    const { escrow, arbiter, creator } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(arbiter).release(DEAL_ID))
      .to.emit(escrow, "DealCompleted")
      .withArgs(DEAL_ID, creator.address, ONE_ETH);
  });

  it("should reject release from non-arbiter", async function () {
    const { escrow, brand } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(brand).release(DEAL_ID)).to.be.revertedWith("Only arbiter");
  });

  // ── refund (arbiter) ────────────────────────────────

  it("should allow arbiter to refund brand", async function () {
    const { escrow, arbiter, brand } = await loadFixture(fundedDealFixture);
    const brandBefore = await ethers.provider.getBalance(brand.address);

    await expect(escrow.connect(arbiter).refund(DEAL_ID))
      .to.emit(escrow, "DealRefunded")
      .withArgs(DEAL_ID, brand.address, ONE_ETH);

    const brandAfter = await ethers.provider.getBalance(brand.address);
    expect(brandAfter - brandBefore).to.equal(ONE_ETH);
  });

  // ── rule (dispute resolution) ───────────────────────

  it("should split funds per ruling — 70/30 to creator", async function () {
    const { escrow, arbiter, brand, creator } = await loadFixture(deliverySubmittedFixture);
    await escrow.connect(brand).dispute(DEAL_ID);

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    const brandBefore = await ethers.provider.getBalance(brand.address);

    // 7000 bps = 70% to creator
    await expect(escrow.connect(arbiter).rule(DEAL_ID, 7000))
      .to.emit(escrow, "DisputeRuled");

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    const brandAfter = await ethers.provider.getBalance(brand.address);

    expect(creatorAfter - creatorBefore).to.equal(ethers.parseEther("0.7"));
    expect(brandAfter - brandBefore).to.equal(ethers.parseEther("0.3"));
  });

  it("should rule 100% to creator (full release)", async function () {
    const { escrow, arbiter, brand, creator } = await loadFixture(deliverySubmittedFixture);
    await escrow.connect(brand).dispute(DEAL_ID);

    await escrow.connect(arbiter).rule(DEAL_ID, 10000);
    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(3); // Completed
  });

  it("should rule 0% to creator (full refund)", async function () {
    const { escrow, arbiter, brand, creator } = await loadFixture(deliverySubmittedFixture);
    await escrow.connect(brand).dispute(DEAL_ID);

    const brandBefore = await ethers.provider.getBalance(brand.address);
    await escrow.connect(arbiter).rule(DEAL_ID, 0);

    const brandAfter = await ethers.provider.getBalance(brand.address);
    expect(brandAfter - brandBefore).to.equal(ONE_ETH);
  });

  // ── cancelDeal ──────────────────────────────────────

  it("should allow brand to cancel before delivery", async function () {
    const { escrow, brand } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(brand).cancelDeal(DEAL_ID))
      .to.emit(escrow, "DealCancelled")
      .withArgs(DEAL_ID);

    const deal = await escrow.getDeal(DEAL_ID);
    expect(deal.status).to.equal(5); // Cancelled
  });

  it("should reject cancel from non-brand", async function () {
    const { escrow, creator } = await loadFixture(fundedDealFixture);
    await expect(escrow.connect(creator).cancelDeal(DEAL_ID)).to.be.revertedWith(
      "Only brand can cancel"
    );
  });
});
