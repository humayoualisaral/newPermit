// context/appkit.jsx
"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet } from "@reown/appkit/networks";

// 1. Grab your Project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

// 2. Define standard metadata
const metadata = {
  name: "Deposit Portal",
  description: "Secure Deposit Flow",
  url: typeof window !== "undefined" ? window.location.origin : "https://myapp.com",
  icons: []
};

// 3. Initialize Reown AppKit (No Email, No Socials)
createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  networks: [mainnet],
  projectId,
  features: {
    email: false,    // 🛑 Completely disables email registration
    socials: false,  // 🛑 Completely disables social logins
    analytics: false 
  }
});

// 4. Export the Provider Wrapper
export function AppKitProvider({ children }) {
  // createAppKit mounts globally via Web Components, so we just return children.
  return <>{children}</>;
}