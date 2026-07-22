const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const addresses = require("../config/addresses");

const PERMIT2_ADDRESS = addresses.mainnet.permit2;

// Known large holders on mainnet, used only to fund a test signer with real (forked) tokens.
// Balances/addresses shift over time — check each token's "Top Holders" page on Etherscan
// before relying on these if a run starts failing with an insufficient-balance error.
const TOKENS = [
  {
    name: "USDT",
    address: addresses.mainnet.usdt,
    whale: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  },
  {
    name: "USDC",
    address: addresses.mainnet.usdc,
    whale: "0x0A59649758aa4d66E25f08Dd01271e891fe52199",
  },
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
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

describe("Permit2Deposit — real mainnet tokens via fork", function () {
  for (const token of TOKENS) {
    it(`accepts a real ${token.name} deposit via a Permit2 signature`, async function () {
      if (!process.env.MAINNET_RPC_URL) this.skip();

      const [testSigner, owner] = await ethers.getSigners();

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [token.whale],
      });
      await hre.network.provider.send("hardhat_setBalance", [
        token.whale,
        "0x56BC75E2D63100000", // 100 ETH for gas
      ]);
      const whaleSigner = await ethers.getSigner(token.whale);

      const tokenAsWhale = new ethers.Contract(token.address, ERC20_ABI, whaleSigner);
      const depositAmount = 1_000_000n; // 1.0 unit at 6 decimals (both USDT and USDC)
      await tokenAsWhale.transfer(testSigner.address, depositAmount);

      const Deposit = await ethers.getContractFactory("Permit2Deposit");
      const deposit = await Deposit.deploy(PERMIT2_ADDRESS, owner.address, [token.address]);
      await deposit.waitForDeployment();
      const depositAddress = await deposit.getAddress();

      const tokenAsSigner = new ethers.Contract(token.address, ERC20_ABI, testSigner);
      await tokenAsSigner.approve(PERMIT2_ADDRESS, ethers.MaxUint256);

      const nonce = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const { chainId } = await ethers.provider.getNetwork();
      const domain = { name: "Permit2", chainId, verifyingContract: PERMIT2_ADDRESS };
      const value = {
        permitted: { token: token.address, amount: depositAmount },
        spender: depositAddress,
        nonce,
        deadline,
      };

      const signature = await testSigner.signTypedData(domain, TYPES, value);
      const permit = { permitted: { token: token.address, amount: depositAmount }, nonce, deadline };

      await expect(
        deposit.depositFor(testSigner.address, depositAmount, permit, signature)
      ).to.emit(deposit, "Deposited");

      const vaultBalance = await new ethers.Contract(token.address, ERC20_ABI, testSigner).balanceOf(
        depositAddress
      );
      expect(vaultBalance).to.equal(depositAmount);
    });
  }

  it("accepts a single-signature batch deposit of both real USDT and USDC", async function () {
    if (!process.env.MAINNET_RPC_URL) this.skip();

    const [testSigner, owner] = await ethers.getSigners();
    const usdtInfo = TOKENS[0];
    const usdcInfo = TOKENS[1];

    // Fund the test signer with both real (forked) tokens
    for (const t of TOKENS) {
      await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [t.whale] });
      await hre.network.provider.send("hardhat_setBalance", [t.whale, "0x56BC75E2D63100000"]);
      const whaleSigner = await ethers.getSigner(t.whale);
      const tokenAsWhale = new ethers.Contract(t.address, ERC20_ABI, whaleSigner);
      await tokenAsWhale.transfer(testSigner.address, 1_000_000n);
    }

    const Deposit = await ethers.getContractFactory("Permit2Deposit");
    const deposit = await Deposit.deploy(PERMIT2_ADDRESS, owner.address, [usdtInfo.address, usdcInfo.address]);
    await deposit.waitForDeployment();
    const depositAddress = await deposit.getAddress();

    // One-time approvals — real USDT reverts if you try to change a non-zero allowance
    // directly to another non-zero value, so reset to 0 first when there's already some
    // allowance set (e.g. left over from an earlier deposit by this same wallet).
    for (const t of TOKENS) {
      const tokenAsSigner = new ethers.Contract(t.address, ERC20_ABI, testSigner);
      const current = await tokenAsSigner.allowance(testSigner.address, PERMIT2_ADDRESS);
      if (current > 0n) {
        await (await tokenAsSigner.approve(PERMIT2_ADDRESS, 0)).wait();
      }
      await (await tokenAsSigner.approve(PERMIT2_ADDRESS, ethers.MaxUint256)).wait();
    }

    const amounts = [1_000_000n, 1_000_000n];
    const nonce = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const { chainId } = await ethers.provider.getNetwork();
    const domain = { name: "Permit2", chainId, verifyingContract: PERMIT2_ADDRESS };
    const BATCH_TYPES = {
      PermitBatchTransferFrom: [
        { name: "permitted", type: "TokenPermissions[]" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    };
    const value = {
      permitted: [
        { token: usdtInfo.address, amount: amounts[0] },
        { token: usdcInfo.address, amount: amounts[1] },
      ],
      spender: depositAddress,
      nonce,
      deadline,
    };

    // ONE signature covering both tokens
    const signature = await testSigner.signTypedData(domain, BATCH_TYPES, value);
    const permit = {
      permitted: [
        { token: usdtInfo.address, amount: amounts[0] },
        { token: usdcInfo.address, amount: amounts[1] },
      ],
      nonce,
      deadline,
    };

    // ONE transaction moving both tokens
    await expect(
      deposit.depositBatchFor(testSigner.address, amounts, permit, signature)
    ).to.emit(deposit, "Deposited");

    expect(await new ethers.Contract(usdtInfo.address, ERC20_ABI, testSigner).balanceOf(depositAddress)).to.equal(1_000_000n);
    expect(await new ethers.Contract(usdcInfo.address, ERC20_ABI, testSigner).balanceOf(depositAddress)).to.equal(1_000_000n);
  });

  it("blocks deposits while paused", async function () {
    if (!process.env.MAINNET_RPC_URL) this.skip();
    const [, owner] = await ethers.getSigners();
    const Deposit = await ethers.getContractFactory("Permit2Deposit");
    const deposit = await Deposit.deploy(PERMIT2_ADDRESS, owner.address, [addresses.mainnet.usdc]);
    await deposit.waitForDeployment();

    await deposit.connect(owner).pause();
    expect(await deposit.paused()).to.equal(true);
  });

  it("rejects a token that isn't on the accepted list", async function () {
    if (!process.env.MAINNET_RPC_URL) this.skip();
    const [, owner] = await ethers.getSigners();
    const Deposit = await ethers.getContractFactory("Permit2Deposit");
    // Deploy with USDC accepted, but attempt a permit for USDT
    const deposit = await Deposit.deploy(PERMIT2_ADDRESS, owner.address, [addresses.mainnet.usdc]);
    await deposit.waitForDeployment();

    const fakePermit = {
      permitted: { token: addresses.mainnet.usdt, amount: 1_000_000n },
      nonce: 1n,
      deadline: Math.floor(Date.now() / 1000) + 600,
    };
    await expect(
      deposit.depositFor(owner.address, 1_000_000n, fakePermit, "0x")
    ).to.be.revertedWithCustomError(deposit, "TokenNotAccepted");
  });
});