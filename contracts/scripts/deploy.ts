import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Escrow with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const arbiter = deployer.address; // agent wallet = deployer for hackathon
  const feeBps = 250; // 2.5% platform fee
  const feeRecipient = deployer.address; // treasury = agent wallet for now

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(arbiter, feeBps, feeRecipient);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("Escrow deployed to:", address);
  console.log("Arbiter:", arbiter);
  console.log("Platform fee:", feeBps, "bps (2.5%)");
  console.log("Fee recipient:", feeRecipient);
  console.log("\nAdd to .env:");
  console.log(`ESCROW_CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
