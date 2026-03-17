// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockWstETH
 * @notice Simulates Lido's wstETH wrap/unwrap for hackathon demo on Base Sepolia.
 *         In production, this would be replaced by Lido's actual wstETH contract.
 *         Exchange rate starts at 1:1 and can be increased to simulate yield accrual.
 */
contract MockWstETH {
    mapping(address => uint256) public balanceOf;
    uint256 public exchangeRate = 1e18; // wstETH per ETH (starts 1:1)
    address public owner;

    event Wrapped(address indexed account, uint256 ethAmount, uint256 wstETHAmount);
    event Unwrapped(address indexed account, uint256 wstETHAmount, uint256 ethAmount);
    event YieldSimulated(uint256 oldRate, uint256 newRate);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Wrap ETH into wstETH. Returns amount of wstETH minted.
    function wrap() external payable returns (uint256 wstETHAmount) {
        require(msg.value > 0, "Must send ETH");
        wstETHAmount = (msg.value * 1e18) / exchangeRate;
        balanceOf[msg.sender] += wstETHAmount;
        emit Wrapped(msg.sender, msg.value, wstETHAmount);
    }

    /// @notice Unwrap wstETH back to ETH. Returns amount of ETH sent.
    function unwrap(uint256 wstETHAmount) external returns (uint256 ethAmount) {
        require(balanceOf[msg.sender] >= wstETHAmount, "Insufficient balance");
        balanceOf[msg.sender] -= wstETHAmount;
        ethAmount = (wstETHAmount * exchangeRate) / 1e18;
        (bool ok, ) = msg.sender.call{value: ethAmount}("");
        require(ok, "ETH transfer failed");
        emit Unwrapped(msg.sender, wstETHAmount, ethAmount);
    }

    /// @notice Simulate yield accrual by increasing the exchange rate.
    ///         E.g., rate 1.05e18 means 1 wstETH = 1.05 ETH (5% yield).
    function simulateYield(uint256 newRate) external {
        require(msg.sender == owner, "Only owner");
        require(newRate >= exchangeRate, "Rate can only increase");
        emit YieldSimulated(exchangeRate, newRate);
        exchangeRate = newRate;
    }

    /// @notice Get how much ETH a given wstETH amount is worth.
    function getETHByWstETH(uint256 wstETHAmount) external view returns (uint256) {
        return (wstETHAmount * exchangeRate) / 1e18;
    }

    /// @notice Get how much wstETH a given ETH amount would mint.
    function getWstETHByETH(uint256 ethAmount) external view returns (uint256) {
        return (ethAmount * 1e18) / exchangeRate;
    }

    receive() external payable {}
}
