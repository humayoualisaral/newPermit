// Server-side only — imported exclusively by files under app/api/*, which run in the
// Node.js runtime, never in the browser. These env vars are NOT prefixed with NEXT_PUBLIC_,
// so Next.js never bundles them into client-side JS. Set the real values in Vercel's
// dashboard (Settings -> Environment Variables), not committed to any .env file.

import { ethers } from "ethers";

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Same ABI your Express backend used — depositFor / depositBatchFor on Permit2Deposit.sol.
const CONTRACT_ABI = [
  "function depositFor(address depositor, uint256 amount, (( address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, bytes signature) external",
  "function depositBatchFor(address depositor, uint256[] amounts, ((address token, uint256 amount)[] permitted, uint256 nonce, uint256 deadline) permit, bytes signature) external",
  "event Deposited(address indexed depositor, address indexed token, uint256 amount, address indexed submitter)",
];

// Module-level cache: on a warm serverless instance, Next.js reuses this module between
// invocations, so we avoid reconnecting the provider/wallet on every single request.
let cached = null;

export function getRelayerContract() {
  if (!RPC_URL || !RELAYER_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error(
      "Missing SEPOLIA_RPC_URL, RELAYER_PRIVATE_KEY, or CONTRACT_ADDRESS environment variable(s)."
    );
  }
  if (!cached) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayerWallet);
    cached = { contract, relayerWallet };
  }
  return cached;
}

export function getContractAddress() {
  return CONTRACT_ADDRESS;
}
