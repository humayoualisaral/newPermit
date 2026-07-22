import { getRelayerContract, getContractAddress } from "../../../lib/relayer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { relayerWallet } = getRelayerContract();
    return Response.json({ relayer: relayerWallet.address, contract: getContractAddress() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
