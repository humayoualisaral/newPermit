// The ONLY file that should differ between testnet and mainnet deployments.
// Permit2's address is identical across chains, so really it's just the token
// addresses that change when you move from Sepolia to mainnet.

module.exports = {
  sepolia: {
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle official Sepolia USDC
    // Verified "Test Tether USD" contract — its transfer/approve/transferFrom have no return
    // value, same as real mainnet USDT, so it actually exercises that quirk (unlike MockUSDT.sol,
    // which is a plain well-behaved ERC20 and is kept only as a simpler fallback).
    usdt: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06",
  },
  mainnet: {
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
};
