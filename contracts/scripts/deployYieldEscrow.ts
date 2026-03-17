import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying YieldEscrow with account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    const disputeWindow = parseInt(process.env.DISPUTE_WINDOW_SECONDS ?? "86400");
    const arbiter = deployer.address; // agent wallet = deployer
    const feeBps = 250; // 2.5% platform fee
    const feeRecipient = deployer.address; // treasury = agent wallet

    console.log("\n1. Deploying MockWstETH...");
    const MockWstETH = await ethers.getContractFactory("MockWstETH");
    const wstETH = await MockWstETH.deploy();
    await wstETH.waitForDeployment();
    const wstETHAddress = await wstETH.getAddress();
    console.log("MockWstETH deployed to:", wstETHAddress);

    console.log("\n2. Deploying YieldEscrow...");
    const YieldEscrow = await ethers.getContractFactory("YieldEscrow");
    const escrow = await YieldEscrow.deploy(arbiter, wstETHAddress, disputeWindow, feeBps, feeRecipient);
    await escrow.waitForDeployment();
    const address = await escrow.getAddress();

    console.log("YieldEscrow deployed to:", address);
    console.log("Arbiter:", arbiter);
    console.log("WstETH Address:", wstETHAddress);
    console.log("Dispute window:", disputeWindow, "seconds");
    console.log("Platform fee:", feeBps, "bps (2.5%)");
    console.log("Fee recipient:", feeRecipient);
    console.log("\nAdd to .env:");
    console.log(`YIELD_ESCROW_ADDRESS=${address}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
