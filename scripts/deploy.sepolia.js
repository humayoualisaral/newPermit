const hre = require("hardhat");
const addresses = require("../config/addresses");

async function main() {
  const net = addresses.sepolia;
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No signer found — DEPLOYER_PRIVATE_KEY is missing or empty in your root .env file " +
      "(the one next to hardhat.config.js, NOT backend/.env or frontend/.env.local)."
    );
  }

  const acceptedTokens = [net.usdc, net.usdt];
  
  // permit2 is no longer passed to the constructor
  const constructorArgs = [deployer.address, acceptedTokens];

  const Deposit = await hre.ethers.getContractFactory("Permit2Deposit");
  const deposit = await Deposit.deploy(...constructorArgs);
  await deposit.waitForDeployment();
  const address = await deposit.getAddress();

  console.log("Permit2Deposit (sepolia) deployed to:", address);
  console.log("Owner:", deployer.address);
  console.log("Accepted tokens:", acceptedTokens);

  if (!process.env.ETHERSCAN_API_KEY) {
    console.log("\nSkipping verification — set ETHERSCAN_API_KEY in .env to enable it.");
    return;
  }

  console.log("\nWaiting for 5 block confirmations before verifying...");
  const deployTx = deposit.deploymentTransaction();
  await deployTx.wait(5);

  console.log("Verifying on Etherscan...");
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log("✅ Verified:", `https://sepolia.etherscan.io/address/${address}#code`);
  } catch (err) {
    if (err.message.toLowerCase().includes("already verified")) {
      console.log("Already verified.");
    } else {
      console.error("Verification failed:", err.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});