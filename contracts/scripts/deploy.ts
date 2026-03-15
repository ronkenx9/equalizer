import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Escrow with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const disputeWindow = parseInt(process.env.DISPUTE_WINDOW_SECONDS ?? "86400");
  const arbiter = deployer.address; // agent wallet = deployer for hackathon

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(arbiter, disputeWindow);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("Escrow deployed to:", address);
  console.log("Arbiter:", arbiter);
  console.log("Dispute window:", disputeWindow, "seconds");
  console.log("\nAdd to .env:");
  console.log(`ESCROW_CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
