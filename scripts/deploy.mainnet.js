const hre = require("hardhat");
const readline = require("readline");
const addresses = require("../config/addresses");

function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  // Safety guard: make sure we're actually targeting mainnet
  if (hre.network.name !== "mainnet") {
    throw new Error(
      `This script is for mainnet only. Current network: "${hre.network.name}". ` +
      `Run with --network mainnet.`
    );
  }

  const net = addresses.mainnet;
  if (!net || !net.usdc || !net.usdt) {
    throw new Error(
      "Missing mainnet addresses — check config/addresses.js for a `mainnet` entry with usdc/usdt set."
    );
  }

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No signer found — DEPLOYER_PRIVATE_KEY is missing or empty in your root .env file " +
      "(the one next to hardhat.config.js, NOT backend/.env or frontend/.env.local)."
    );
  }

  const acceptedTokens = [net.usdc, net.usdt];
  const constructorArgs = [deployer.address, acceptedTokens];

  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("=== MAINNET DEPLOYMENT ===");
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Accepted tokens:", acceptedTokens);
  console.log("===========================\n");

  const answer = await confirm(
    "You are about to deploy Permit2Deposit to ETHEREUM MAINNET. This costs real ETH. Type 'deploy' to continue: "
  );
  if (answer !== "deploy") {
    console.log("Aborted.");
    return;
  }

  const Deposit = await hre.ethers.getContractFactory("Permit2Deposit");
  const deposit = await Deposit.deploy(...constructorArgs);
  await deposit.waitForDeployment();
  const address = await deposit.getAddress();

  console.log("\nPermit2Deposit (mainnet) deployed to:", address);
  console.log("Owner:", deployer.address);
  console.log("Accepted tokens:", acceptedTokens);
  console.log("Explorer:", `https://etherscan.io/address/${address}`);

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
    console.log("✅ Verified:", `https://etherscan.io/address/${address}#code`);
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