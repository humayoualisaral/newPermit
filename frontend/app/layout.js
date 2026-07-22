import "./globals.css";

export const metadata = {
  title: "Permit2 Deposit — Sepolia Test",
  description: "Test harness for the Permit2 receiving flow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
