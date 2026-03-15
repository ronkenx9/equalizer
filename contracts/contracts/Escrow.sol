// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Escrow
 * @notice Factory-pattern escrow: one contract manages all deals.
 *         The arbiter (EQUALIZER agent wallet) mediates and executes rulings.
 *         autoRelease is permissionless — silence = release.
 */
contract Escrow is ReentrancyGuard {
    // ── Types ──────────────────────────────────────────────
    enum Status {
        Created,        // 0 — brand deposited, waiting for delivery
        DeliverySubmitted, // 1 — creator submitted, dispute window running
        Disputed,       // 2 — brand raised dispute during window
        Completed,      // 3 — funds released to creator
        Refunded,       // 4 — funds returned to brand
        Cancelled       // 5 — cancelled before delivery
    }

    struct Deal {
        address brand;
        address creator;
        uint256 amount;
        uint256 deadline;
        uint256 disputeWindowEnd;
        string termsHash;
        Status status;
    }

    // ── State ──────────────────────────────────────────────
    address public immutable arbiter;
    uint256 public disputeWindowDuration;
    mapping(bytes32 => Deal) public deals;

    // ── Events ─────────────────────────────────────────────
    event DealCreated(bytes32 indexed dealId, address indexed brand, address indexed creator, uint256 amount, string termsHash);
    event DeliverySubmitted(bytes32 indexed dealId);
    event DisputeRaised(bytes32 indexed dealId);
    event DealCompleted(bytes32 indexed dealId, address indexed recipient, uint256 amount);
    event DealRefunded(bytes32 indexed dealId, address indexed brand, uint256 amount);
    event DisputeRuled(bytes32 indexed dealId, uint256 creatorShare, uint256 brandShare);
    event DealCancelled(bytes32 indexed dealId);

    // ── Modifiers ──────────────────────────────────────────
    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter");
        _;
    }

    modifier dealExists(bytes32 dealId) {
        require(deals[dealId].brand != address(0), "Deal not found");
        _;
    }

    // ── Constructor ────────────────────────────────────────
    constructor(address _arbiter, uint256 _disputeWindowDuration) {
        require(_arbiter != address(0), "Invalid arbiter");
        arbiter = _arbiter;
        disputeWindowDuration = _disputeWindowDuration;
    }

    // ── Core Functions ─────────────────────────────────────

    /// @notice Brand creates a deal and deposits ETH in one tx.
    function createDeal(
        bytes32 dealId,
        address creator,
        uint256 deadline,
        string calldata termsHash
    ) external payable {
        require(deals[dealId].brand == address(0), "Deal already exists");
        require(creator != address(0), "Invalid creator");
        require(msg.value > 0, "Must deposit ETH");
        require(deadline > block.timestamp, "Deadline must be future");

        deals[dealId] = Deal({
            brand: msg.sender,
            creator: creator,
            amount: msg.value,
            deadline: deadline,
            disputeWindowEnd: 0,
            termsHash: termsHash,
            status: Status.Created
        });

        emit DealCreated(dealId, msg.sender, creator, msg.value, termsHash);
    }

    /// @notice Creator or arbiter marks delivery submitted. Starts dispute window.
    function submitDelivery(bytes32 dealId) external dealExists(dealId) {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created, "Invalid status");
        require(msg.sender == d.creator || msg.sender == arbiter, "Not authorized");

        d.status = Status.DeliverySubmitted;
        d.disputeWindowEnd = block.timestamp + disputeWindowDuration;

        emit DeliverySubmitted(dealId);
    }

    /// @notice Brand raises dispute during the window.
    function dispute(bytes32 dealId) external dealExists(dealId) {
        Deal storage d = deals[dealId];
        require(d.status == Status.DeliverySubmitted, "Not in delivery phase");
        require(msg.sender == d.brand, "Only brand can dispute");
        require(block.timestamp <= d.disputeWindowEnd, "Dispute window closed");

        d.status = Status.Disputed;
        emit DisputeRaised(dealId);
    }

    /// @notice Arbiter releases full funds to creator.
    function release(bytes32 dealId) external onlyArbiter dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(
            d.status == Status.Created || d.status == Status.DeliverySubmitted,
            "Cannot release"
        );

        uint256 amount = d.amount;
        d.status = Status.Completed;

        (bool ok, ) = d.creator.call{value: amount}("");
        require(ok, "Transfer failed");

        emit DealCompleted(dealId, d.creator, amount);
    }

    /// @notice Arbiter refunds full funds to brand.
    function refund(bytes32 dealId) external onlyArbiter dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(
            d.status == Status.Created || d.status == Status.Disputed,
            "Cannot refund"
        );

        uint256 amount = d.amount;
        d.status = Status.Refunded;

        (bool ok, ) = d.brand.call{value: amount}("");
        require(ok, "Transfer failed");

        emit DealRefunded(dealId, d.brand, amount);
    }

    /// @notice Arbiter issues ruling after dispute — split funds.
    /// @param creatorBps Creator's share in basis points (0-10000). Brand gets the rest.
    function rule(bytes32 dealId, uint256 creatorBps) external onlyArbiter dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.Disputed, "Not disputed");
        require(creatorBps <= 10000, "Invalid bps");

        uint256 total = d.amount;
        uint256 creatorShare = (total * creatorBps) / 10000;
        uint256 brandShare = total - creatorShare;

        d.status = Status.Completed;

        if (creatorShare > 0) {
            (bool ok1, ) = d.creator.call{value: creatorShare}("");
            require(ok1, "Creator transfer failed");
        }
        if (brandShare > 0) {
            (bool ok2, ) = d.brand.call{value: brandShare}("");
            require(ok2, "Brand transfer failed");
        }

        emit DisputeRuled(dealId, creatorShare, brandShare);
    }

    /// @notice PERMISSIONLESS: anyone can trigger after dispute window expires.
    ///         This is the key mechanic — silence = release. No human needed.
    function autoRelease(bytes32 dealId) external dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.DeliverySubmitted, "Not in delivery phase");
        require(d.disputeWindowEnd > 0, "No dispute window set");
        require(block.timestamp > d.disputeWindowEnd, "Window still open");

        uint256 amount = d.amount;
        d.status = Status.Completed;

        (bool ok, ) = d.creator.call{value: amount}("");
        require(ok, "Transfer failed");

        emit DealCompleted(dealId, d.creator, amount);
    }

    /// @notice Brand cancels deal before delivery submitted.
    function cancelDeal(bytes32 dealId) external dealExists(dealId) nonReentrant {
        Deal storage d = deals[dealId];
        require(d.status == Status.Created, "Cannot cancel");
        require(msg.sender == d.brand, "Only brand can cancel");

        uint256 amount = d.amount;
        d.status = Status.Cancelled;

        (bool ok, ) = d.brand.call{value: amount}("");
        require(ok, "Transfer failed");

        emit DealCancelled(dealId);
    }

    // ── View ───────────────────────────────────────────────

    function getDeal(bytes32 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }
}
