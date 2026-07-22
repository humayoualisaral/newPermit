const hre = require("hardhat");

// Usage: BOT_ADDRESS=0x... CONTRACT_ADDRESS=0x... npx hardhat run scripts/setBotAddress.js --network sepolia
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const botAddress = process.env.BOT_ADDRESS;
  if (!contractAddress || !botAddress) {
    throw new Error("Set CONTRACT_ADDRESS and BOT_ADDRESS env vars before running this.");
  }

  // Must be run with the OWNER's key configured for this network (DEPLOYER_PRIVATE_KEY for
  // sepolia, MAINNET_DEPLOYER_PRIVATE_KEY for mainnet) — setBotAddress is onlyOwner.
  const deposit = await hre.ethers.getContractAt("Permit2Deposit", contractAddress);
  const tx = await deposit.setBotAddress(botAddress);
  console.log("Submitted:", tx.hash);
  await tx.wait();
  console.log("Confirmed. botAddress is now:", await deposit.botAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
