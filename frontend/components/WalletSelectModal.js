"use client";

import { useInjectedWallets } from "../lib/useInjectedWallets";
import { getWalletConnectProvider } from "../lib/walletconnect";

export default function WalletSelectModal({ onSelect, onClose }) {
  const injectedWallets = useInjectedWallets();

  const connectInjected = async (rawProvider) => {
    await rawProvider.request({ method: "eth_requestAccounts" });
    onSelect(rawProvider);
  };

  const connectWalletConnect = async () => {
    try {
      const wcProvider = await getWalletConnectProvider();
      await wcProvider.connect(); // opens the QR modal — scan with Trust Wallet mobile
      onSelect(wcProvider);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Connect a wallet</strong>
          <button onClick={onClose} style={{ marginTop: 0, background: "transparent", color: "#333", border: "none" }}>
            ✕
          </button>
        </div>

        {injectedWallets.length === 0 && (
          <p style={{ fontSize: 13, color: "#666" }}>
            No browser extension wallets detected. Install Trust Wallet or MetaMask, or use WalletConnect below for Trust Wallet mobile.
          </p>
        )}

        {injectedWallets.map(({ info, provider }) => (
          <button key={info.uuid} onClick={() => connectInjected(provider)} style={walletRowStyle}>
            {info.icon && <img src={info.icon} alt="" width={20} height={20} />}
            {info.name}
          </button>
        ))}

        <button onClick={connectWalletConnect} style={walletRowStyle}>
          WalletConnect (Trust Wallet mobile & others)
        </button>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modalStyle = {
  background: "#fff",
  borderRadius: 10,
  padding: 20,
  width: 320,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const walletRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  justifyContent: "flex-start",
  background: "#f2f2f2",
  color: "#111",
  border: "1px solid #ddd",
};
