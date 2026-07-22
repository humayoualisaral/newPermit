require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL = process.env.MAINNET_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!RPC_URL || !RELAYER_PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error("Missing SEPOLIA_RPC_URL, RELAYER_PRIVATE_KEY, or CONTRACT_ADDRESS in .env");
  process.exit(1);
}

const CONTRACT_ABI = [
  "function pull(address token, address from, address to, uint256 amount) external",
  // Ensure the types match exactly what is in your Solidity contract:
  "function pullBatch(address[] tokens, address[] froms, address[] tos, uint256[] amounts) external",
  "event Pulled(address indexed operator, address indexed token, address indexed from, address to, uint256 amount)"
];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayerWallet);

// Single token deposit via operator pull
app.post("/deposit", async (req, res) => {
  try {
    const { depositor, token, amount } = req.body;

    if (!depositor || !token || !amount) {
      return res.status(400).json({ error: "Missing depositor, token, or amount" });
    }

    console.log(`Submitting pull: ${amount} of ${token} from ${depositor}`);

    // Pulling directly into the contract
    const tx = await contract.pull(token, depositor, CONTRACT_ADDRESS, amount);
    console.log("Submitted tx:", tx.hash);

    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);

    res.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (err) {
    console.error("Deposit failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Multi-token deposit via operator pullBatch
app.post("/deposit-batch", async (req, res) => {
  try {
    const { depositor, tokens, amounts } = req.body;

    // 1. Validation
    if (!depositor || !tokens || !amounts || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: "Invalid input: ensure tokens and amounts are arrays" });
    }

    console.log(`Submitting batch pull for: ${depositor}`);
    
    // 2. Prepare arrays for Solidity (must be exactly 4 arguments)
    const froms = tokens.map(() => depositor);
    const tos = tokens.map(() => CONTRACT_ADDRESS);

    // 3. Execution
    const tx = await contract.pullBatch(tokens, froms, tos, amounts);
    console.log("Submitted tx:", tx.hash);

    const receipt = await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Batch deposit failed:", err);
    res.status(500).json({ error: err.message });
  }
});
// EIP-2612 Permit and Pull (if your frontend ever uses EIP-2612 signatures)
app.post("/deposit-permit", async (req, res) => {
    try {
      const { token, depositor, amount, deadline, v, r, s } = req.body;
  
      console.log(`Submitting permitAndPull: ${amount} of ${token} from ${depositor}`);
      
      const tx = await contract.permitAndPull(token, depositor, CONTRACT_ADDRESS, amount, deadline, v, r, s);
      console.log("Submitted tx:", tx.hash);
  
      const receipt = await tx.wait();
      console.log("Confirmed in block:", receipt.blockNumber);
  
      res.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
    } catch (err) {
      console.error("Permit deposit failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

app.get("/health", (req, res) => {
  res.json({ relayer: relayerWallet.address, contract: CONTRACT_ADDRESS });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Relayer backend listening on port ${PORT}`));