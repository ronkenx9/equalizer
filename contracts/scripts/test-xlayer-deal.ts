import { ethers } from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Test account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "OKB");

    const escrowAddress = "0x02a51207f114b47DED4fa1597639344747eb4b4D";
    const escrow = await ethers.getContractAt("Escrow", escrowAddress);

    // Generate a unique deal ID
    const dealId = keccak256(toUtf8Bytes(`xlayer-hackathon-test-${Date.now()}`));
    const creatorAddress = deployer.address; // self-deal for testing
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24h from now
    const disputeWindow = 3600; // 1 hour
    const termsHash = "X Layer Hackathon Test Deal - Escrow Deposit Proof";
    const depositAmount = ethers.parseEther("0.001"); // 0.001 OKB

    console.log("\n--- Creating Deal on X Layer Testnet ---");
    console.log("Deal ID:", dealId);
    console.log("Deposit:", "0.001 OKB");
    console.log("Terms:", termsHash);

    const tx = await escrow.createDeal(
        dealId,
        creatorAddress,
        deadline,
        disputeWindow,
        termsHash,
        { value: depositAmount }
    );

    console.log("\nTx hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ CONFIRMED in block:", receipt?.blockNumber);
    console.log("\n========================================");
    console.log("SUBMISSION TX HASH:", tx.hash);
    console.log("Explorer: https://www.okx.com/web3/explorer/xlayer-test/tx/" + tx.hash);
    console.log("========================================");

    // Read back the deal to verify
    const deal = await escrow.getDeal(dealId);
    console.log("\nOn-chain deal verification:");
    console.log("  Brand:", deal.brand);
    console.log("  Creator:", deal.creator);
    console.log("  Amount:", ethers.formatEther(deal.amount), "OKB");
    console.log("  Status:", Number(deal.status) === 0 ? "Created ✅" : `Status ${deal.status}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
