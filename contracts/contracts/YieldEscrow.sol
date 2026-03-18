// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWstETH {
    function wrap() external payable returns (uint256);
    function unwrap(uint256 wstETHAmount) external returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function getETHByWstETH(uint256 wstETHAmount) external view returns (uint256);
}

/**
 * @title YieldEscrow
 * @notice Yield-bearing escrow: deposited ETH is wrapped to wstETH via Lido.
 *         While funds sit in escrow, they earn staking yield.
 *         On settlement: principal goes to recipient, yield goes to agent treasury.
 *
 *         Same interface as Escrow.sol — drop-in replacement.
 *         In production, IWstETH points to Lido's real wstETH contract.
 *         For hackathon demo, it points to MockWstETH on Base Sepolia.
 */
contract YieldEscrow is ReentrancyGuard {
    enum Status {
        Created,
        DeliverySubmitted,
        Disputed,
        Completed,
        Refunded,
        Cancelled
    }

    struct Deal {
        address brand;
        address creator;
        uint256 originalAmount;   // ETH deposited by brand
        uint256 wstETHAmount;     // wstETH held in escrow
        uint256 deadline;
        uint256 disputeWindowDuration;
        uint256 disputeWindowEnd;
        uint256 feeBps; // Locked at creation
        string termsHash;
        Status status;
    }

    address public immutable arbiter;
    IWstETH public immutable wstETH;
    uint256 public feeBps;
    address public feeRecipient;
    uint256 public totalFeesCollected;
    uint256 public totalYieldEarned;
    mapping(bytes32 => Deal) public deals;

    event DealCreated(bytes32 indexed dealId, address indexed brand, address indexed creator, uint256 amount, uint256 disputeWindowDuration, uint256 wstETHAmount, string termsHash);
    event DeliverySubmitted(bytes32 indexed dealId);
    event DisputeRaised(bytes32 indexed dealId);
    event DealCompleted(bytes32 indexed dealId, address indexed recipient, uint256 amount, uint256 yieldEarned);
    event DealRefunded(bytes32 indexed dealId, address indexed brand, uint256 amount, uint256 yieldEarned);
    event DisputeRuled(bytes32 indexed dealId, uint256 creatorShare, uint256 brandShare, uint256 yieldEarned);
    event DealCancelled(bytes32 indexed dealId);
    event FeeCollected(bytes32 indexed dealId, uint256 feeAmount);
    event YieldHarvested(bytes32 indexed dealId, uint256 yieldAmount);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter");
        _;
    }

    modifier dealExists(bytes32 dealId) {
        require(deals[dealId].brand != address(0), "Deal not found");
        _;
    }

    constructor(
        address _arbiter,
        address _wstETH,
        uint256 _feeBps,
        address _feeRecipient
    ) {
        require(_arbiter != address(0), "Invalid arbiter");
        require(_wstETH != address(0), "Invalid wstETH");
        require(_feeBps <= 1000, "Fee too high");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        arbiter = _arbiter;
        wstETH = IWstETH(_wstETH);
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    // ── Internal helpers ─────────────────────────────────────

    /// @dev Unwrap wstETH, separate principal from yield, send yield to treasury.
    /// Returns the ETH amount available for settlement (principal portion).
    function _unwrapAndHarvestYield(bytes32 dealId, Deal storage d) internal returns (uint256 totalETH, uint256 yield_) {
        uint256 wstAmt = d.wstETHAmount;
        d.wstETHAmount = 0;

        // Unwrap all wstETH back to ETH
        totalETH = wstETH.unwrap(wstAmt);

        // Yield = unwrapped ETH - original deposit
        if (totalETH > d.originalAmount) {
            yield_ = totalETH - d.originalAmount;
            totalYieldEarned += yield_;

            // Send yield to treasury
            (bool ok, ) = feeRecipient.call{value: yield_}("");
            require(ok, "Yield transfer failed");
            emit YieldHarvested(dealId, yield_);

            // Settlement uses only the principal
            totalETH = d.originalAmount;
        }
    }

    /// @dev Deducts platform fee from amount, sends fee to treasury.
    function _deductFee(bytes32 dealId, uint256 amount, uint256 dealFeeBps) internal returns (uint256 netAmount) {
        if (dealFeeBps == 0) return amount;
        uint256 fee = (amount * dealFeeBps) / 10000;
        netAmount = amount - fee;
        if (fee > 0) {
            totalFeesCollected += fee;
            (bool ok, ) = feeRecipient.call{value: fee}("");
            require(ok, "Fee transfer failed");
            emit FeeCollected(dealId, fee);
        }
    }

    // ── Core Functions ───────────────────────────────────────

    /// @notice Brand creates a deal. ETH is immediately wrapped to wstETH.
    function createDeal(
        bytes32 dealId,
        address creator,
        uint256 deadline,
        uint256 disputeWindowDuration,
        string calldata termsHash
    ) external payable {
        require(deals[dealId].brand == address(0), "Deal already exists");
        require(creator != address(0), "Invalid creator");
        require(msg.value > 0, "Must deposit ETH");
        require(deadline > block.timestamp, "Deadline must be future");
        require(disputeWindowDuration > 0, "Window > 0");

        // Wrap ETH to wstETH immediately
        uint256 wstETHAmount = wstETH.wrap{value: msg.value}();

        deals[dealId] = Deal({
            brand: msg.sender,
            creator: creator,
            originalAmount: msg.value,
            wstETHAmount: wstETHAmount,
            deadline: deadline,
            disputeWindowDuration: disputeWindowDuration,
            disputeWindowEnd: 0,
            feeBps: feeBps,
            termsHash: termsHash,
            status: Status.Created
        });

        emit DealCreated(dealId, msg.sender, creator, msg.value, disputeWindowDuration, wstETHAmount, termsHash);
    }

    /// @notice Allows the brand or the AI arbiter to grant the creator more time to deliver.
    function extendDeadline(bytes32 dealId, uint256 newDeadline) external dealExists(dealId) {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created, "Can only extend before delivery");
        require(msg.sender == d.brand || msg.sender == arbiter, "Only brand or arbiter");
        require(newDeadline > d.deadline, "New deadline must be greater");
        
        d.deadline = newDeadline;
    }

    function submitDelivery(bytes32 dealId) external dealExists(dealId) {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created, "Invalid status");
        require(msg.sender == d.creator || msg.sender == arbiter, "Not authorized");
        d.status = Status.DeliverySubmitted;
        d.disputeWindowEnd = block.timestamp + d.disputeWindowDuration;
        emit DeliverySubmitted(dealId);
    }

    function dispute(bytes32 dealId) external dealExists(dealId) {
        Deal storage d = deals[dealId];
        require(d.status == Status.DeliverySubmitted, "Not in delivery phase");
        require(msg.sender == d.brand, "Only brand can dispute");
        require(block.timestamp <= d.disputeWindowEnd, "Dispute window closed");
        d.status = Status.Disputed;
        emit DisputeRaised(dealId);
    }

    /// @notice Release to creator. Yield goes to treasury, fee on creator payout.
    function release(bytes32 dealId) external onlyArbiter dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created || d.status == Status.DeliverySubmitted, "Cannot release");

        (uint256 principal, uint256 yield_) = _unwrapAndHarvestYield(dealId, d);
        d.status = Status.Completed;

        uint256 netAmount = _deductFee(dealId, principal, d.feeBps);
        (bool ok, ) = d.creator.call{value: netAmount}("");
        require(ok, "Transfer failed");

        emit DealCompleted(dealId, d.creator, netAmount, yield_);
    }

    /// @notice Refund to brand. Yield goes to treasury. No fee on refunds.
    function refund(bytes32 dealId) external onlyArbiter dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created || d.status == Status.Disputed, "Cannot refund");

        (uint256 principal, uint256 yield_) = _unwrapAndHarvestYield(dealId, d);
        d.status = Status.Refunded;

        (bool ok, ) = d.brand.call{value: principal}("");
        require(ok, "Transfer failed");

        emit DealRefunded(dealId, d.brand, principal, yield_);
    }

    /// @notice Arbiter splits funds after dispute. Yield to treasury, fee on creator share.
    function rule(bytes32 dealId, uint256 creatorBps) external onlyArbiter dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.Disputed, "Not disputed");
        require(creatorBps <= 10000, "Invalid bps");

        (uint256 principal, uint256 yield_) = _unwrapAndHarvestYield(dealId, d);
        d.status = Status.Completed;

        uint256 creatorGross = (principal * creatorBps) / 10000;
        uint256 brandShare = principal - creatorGross;

        uint256 creatorNet = creatorGross;
        if (creatorGross > 0) {
            creatorNet = _deductFee(dealId, creatorGross, d.feeBps);
            (bool ok1, ) = d.creator.call{value: creatorNet}("");
            require(ok1, "Creator transfer failed");
        }
        if (brandShare > 0) {
            (bool ok2, ) = d.brand.call{value: brandShare}("");
            require(ok2, "Brand transfer failed");
        }

        emit DisputeRuled(dealId, creatorNet, brandShare, yield_);
    }

    /// @notice Permissionless auto-release after window. Yield to treasury.
    function autoRelease(bytes32 dealId) external dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.DeliverySubmitted, "Not in delivery phase");
        require(d.disputeWindowEnd > 0, "No dispute window set");
        require(block.timestamp > d.disputeWindowEnd, "Window still open");

        (uint256 principal, uint256 yield_) = _unwrapAndHarvestYield(dealId, d);
        d.status = Status.Completed;

        uint256 netAmount = _deductFee(dealId, principal, d.feeBps);
        (bool ok, ) = d.creator.call{value: netAmount}("");
        require(ok, "Transfer failed");

        emit DealCompleted(dealId, d.creator, netAmount, yield_);
    }

    /// @notice Brand cancels deal ONLY if deadline has passed without delivery. No fee.
    function cancelDeal(bytes32 dealId) external dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created, "Cannot cancel");
        require(msg.sender == d.brand, "Only brand can cancel");
        require(block.timestamp > d.deadline, "Deadline has not passed");

        (uint256 principal, uint256 yield_) = _unwrapAndHarvestYield(dealId, d);
        d.status = Status.Cancelled;

        (bool ok, ) = d.brand.call{value: principal}("");
        require(ok, "Transfer failed");

        emit DealCancelled(dealId);
    }

    function getDeal(bytes32 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }

    receive() external payable {}
}
