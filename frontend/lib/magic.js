"use client";

import { Magic } from "magic-sdk";

let magicInstance = null;

export function getMagicProvider() {
  const apiKey = process.env.NEXT_PUBLIC_MAGIC_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "Set NEXT_PUBLIC_MAGIC_API_KEY in frontend/.env.local to enable Magic Wallet."
    );
  }

  if (!magicInstance) {
    magicInstance = new Magic(apiKey, {
      network: "mainnet", // Set to your target chain
    });
  }
  
  return magicInstance;
}