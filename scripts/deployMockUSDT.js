const hre = require("hardhat");

async function main() {
  const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
  const token = await MockUSDT.deploy();
  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log("MockUSDT deployed to:", address);

  // Mint yourself 10,000 test USDT (6 decimals)
  const [signer] = await hre.ethers.getSigners();
  const tx = await token.mint(signer.address, 10_000n * 10n ** 6n);
  await tx.wait();
  console.log("Minted 10,000 mUSDT to", signer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
