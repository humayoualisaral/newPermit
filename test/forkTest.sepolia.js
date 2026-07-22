const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const addresses = require("../config/addresses");

const net = addresses.sepolia;

const USDT_ABI = [
  "function _giveMeATokens(uint256 amount)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const TYPES = {
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
};

describe("Permit2Deposit — Sepolia fork (using the public USDT faucet function)", function () {
  before(async function () {
    if (!process.env.SEPOLIA_RPC_URL) this.skip();
    // Point the local Hardhat network at Sepolia's live state instead of mainnet's, without
    // touching hardhat.config.js — this only affects this test file's run.
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{ forking: { jsonRpcUrl: process.env.SEPOLIA_RPC_URL } }],
    });
  });

  it("accepts a Sepolia test-USDT deposit via a Permit2 signature", async function () {
    if (!process.env.SEPOLIA_RPC_URL) this.skip();

    const [testSigner, owner] = await ethers.getSigners();
    const depositAmount = 1_000_000n; // 1.0 test USDT (6 decimals)

    // Self-mint via the test token's public faucet function — no whale impersonation needed.
    const usdt = new ethers.Contract(net.usdt, USDT_ABI, testSigner);
    await usdt._giveMeATokens(depositAmount * 10n); // mint extra headroom

    const Deposit = await ethers.getContractFactory("Permit2Deposit");
    const deposit = await Deposit.deploy(net.permit2, owner.address, [net.usdt]);
    await deposit.waitForDeployment();
    const depositAddress = await deposit.getAddress();

    await usdt.approve(net.permit2, ethers.MaxUint256);

    const nonce = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const { chainId } = await ethers.provider.getNetwork();
    const domain = { name: "Permit2", chainId, verifyingContract: net.permit2 };
    const value = {
      permitted: { token: net.usdt, amount: depositAmount },
      spender: depositAddress,
      nonce,
      deadline,
    };

    const signature = await testSigner.signTypedData(domain, TYPES, value);
    const permit = { permitted: { token: net.usdt, amount: depositAmount }, nonce, deadline };

    await expect(
      deposit.depositFor(testSigner.address, depositAmount, permit, signature)
    ).to.emit(deposit, "Deposited");

    const vaultBalance = await usdt.balanceOf(depositAddress);
    expect(vaultBalance).to.equal(depositAmount);
  });

  // USDC has no public faucet function on-chain — get test USDC from Circle's faucet
  // (https://faucet.circle.com) into a real wallet, set SEPOLIA_USDC_HOLDER to that address
  // in your .env, and this test will impersonate it locally to verify the USDC path too.
  it("accepts a Sepolia USDC deposit via a Permit2 signature (requires SEPOLIA_USDC_HOLDER)", async function () {
    if (!process.env.SEPOLIA_RPC_URL || !process.env.SEPOLIA_USDC_HOLDER) this.skip();

    const holderAddress = process.env.SEPOLIA_USDC_HOLDER;
    const [testSigner, owner] = await ethers.getSigners();
    const depositAmount = 1_000_000n;

    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [holderAddress] });
    await hre.network.provider.send("hardhat_setBalance", [holderAddress, "0x56BC75E2D63100000"]);
    const holder = await ethers.getSigner(holderAddress);

    const usdcAsHolder = new ethers.Contract(net.usdc, USDT_ABI, holder);
    await usdcAsHolder.transfer(testSigner.address, depositAmount);

    const Deposit = await ethers.getContractFactory("Permit2Deposit");
    const deposit = await Deposit.deploy(net.permit2, owner.address, [net.usdc]);
    await deposit.waitForDeployment();
    const depositAddress = await deposit.getAddress();

    const usdcAsSigner = new ethers.Contract(net.usdc, USDT_ABI, testSigner);
    await usdcAsSigner.approve(net.permit2, ethers.MaxUint256);

    const nonce = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const { chainId } = await ethers.provider.getNetwork();
    const domain = { name: "Permit2", chainId, verifyingContract: net.permit2 };
    const value = {
      permitted: { token: net.usdc, amount: depositAmount },
      spender: depositAddress,
      nonce,
      deadline,
    };

    const signature = await testSigner.signTypedData(domain, TYPES, value);
    const permit = { permitted: { token: net.usdc, amount: depositAmount }, nonce, deadline };

    await expect(
      deposit.depositFor(testSigner.address, depositAmount, permit, signature)
    ).to.emit(deposit, "Deposited");
  });
});
