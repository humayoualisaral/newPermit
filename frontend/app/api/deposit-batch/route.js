import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Configuration
const RPC_URL = process.env.MAINNET_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function pullBatch(address[] tokens, address[] froms, address[] tos, uint256[] amounts) external"
];

export async function POST(request) {
  try {
    const body = await request.json();
    const { depositor, tokens, amounts } = body;

    // 1. Validation (This is where your 400 error is coming from)
    if (!depositor || !tokens || !amounts || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: "Missing or invalid inputs" }, { status: 400 });
    }

    // 2. Setup Provider/Wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayerWallet);

    console.log(`Submitting batch pull for: ${depositor}`);

    // 3. Prepare arguments
    const froms = tokens.map(() => depositor);
    const tos = tokens.map(() => CONTRACT_ADDRESS);

    // 4. Execution
    const tx = await contract.pullBatch(tokens, froms, tos, amounts);
    await tx.wait();

    return NextResponse.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Batch deposit failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}