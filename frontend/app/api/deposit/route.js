import { getRelayerContract } from "../../../lib/relayer";

// ethers + the relayer wallet's crypto need the Node.js runtime, not the Edge runtime.
export const runtime = "nodejs";
// Deposits wait for on-chain confirmation, which can take longer than the default 10s.
// This only takes effect on Vercel plans that allow it (Pro+); on Hobby it's capped at 10s
// regardless of this value.
export const maxDuration = 60;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { depositor, amount, permit, signature } = body;
  if (!depositor || !amount || !permit || !signature) {
    return Response.json(
      { error: "Missing depositor, amount, permit, or signature" },
      { status: 400 }
    );
  }

  try {
    const { contract } = getRelayerContract();

    console.log(`Submitting deposit: ${depositor} depositing ${amount} of ${permit.permitted.token}`);
    const tx = await contract.depositFor(depositor, amount, permit, signature);
    console.log("Submitted tx:", tx.hash);

    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);

    return Response.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (err) {
    console.error("Deposit failed:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
