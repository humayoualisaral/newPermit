"use client";

import { useEffect, useState } from "react";

// EIP-6963 "Multi Injected Provider Discovery" — the current standard for detecting multiple
// browser wallet extensions (MetaMask, Trust Wallet, Coinbase Wallet, etc.) without them
// clobbering each other on window.ethereum. Trust Wallet's browser extension supports this.
export function useInjectedWallets() {
  const [wallets, setWallets] = useState([]);

  useEffect(() => {
    const seen = new Map();

    function onAnnounce(event) {
      const { info, provider } = event.detail;
      if (!seen.has(info.uuid)) {
        seen.set(info.uuid, { info, provider });
        setWallets(Array.from(seen.values()));
      }
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Fallback for wallet versions that don't support EIP-6963 yet — checks the legacy
    // window.ethereum object directly. Only used if nothing announced itself after a short
    // wait, so it never creates duplicate entries for wallets that DO support EIP-6963.
    const fallbackTimer = setTimeout(() => {
      if (seen.size > 0) return; // EIP-6963 already found something, skip the fallback
      const eth = typeof window !== "undefined" ? window.ethereum : undefined;
      if (!eth) return;

      const providers = eth.providers && eth.providers.length ? eth.providers : [eth];
      providers.forEach((provider, i) => {
        const name = provider.isTrust || provider.isTrustWallet
          ? "Trust Wallet"
          : provider.isMetaMask
          ? "MetaMask"
          : "Injected Wallet";
        const uuid = `legacy-${name}-${i}`;
        if (!seen.has(uuid)) {
          seen.set(uuid, { info: { uuid, name, icon: null }, provider });
        }
      });
      setWallets(Array.from(seen.values()));
    }, 300);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return wallets;
}
