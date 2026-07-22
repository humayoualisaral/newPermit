"use client";

import { EthereumProvider } from "@walletconnect/ethereum-provider";

let wcProviderPromise = null;

// You need a free WalletConnect Cloud project ID for this to work:
// https://cloud.walletconnect.com — set it as NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
// Without it, WalletConnect (and therefore Trust Wallet mobile via QR code) won't initialize —
// injected wallets (MetaMask extension, Trust Wallet extension/in-app browser) still work fine.
export function getWalletConnectProvider() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in frontend/.env.local (get one free at https://cloud.walletconnect.com) to enable WalletConnect / Trust Wallet mobile."
    );
  }

 if (!wcProviderPromise) {
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1);
    wcProviderPromise = EthereumProvider.init({
      projectId,
      chains: [chainId],
      showQrModal: true,
      metadata: {
        name: "Permit2 Deposit Test",
        description: "Permit2 deposit flow test harness",
        // Dynamically detects localhost:3000 or your live Vercel URL
        url: typeof window !== "undefined" ? window.location.origin : "",
        icons: [],
      },
    });
  }
  return wcProviderPromise;
}
