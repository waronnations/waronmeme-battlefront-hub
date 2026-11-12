// Builds STON.fi v1 GRAM(TON) -> jetton swap messages for a pack. Player signs them via TON Connect.
import { TonClient, toNano } from "@ton/ton";
import { DEX, pTON } from "@ston-fi/sdk";
import { sql } from "@/lib/db/client.server";
import { getMarketCoins } from "@/lib/market/market.server";

const SLIPPAGE = 0.05;
/** TonConnect wallets accept up to 4 messages per transaction. */
export const MESSAGES_PER_TX = 4;

async function tonPriceUsd(): Promise<number> {
  const r = await fetch("https://api.ston.fi/v1/assets/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
  if (!r.ok) throw new Error("GRAM price unavailable");
  const j = (await r.json()) as { asset?: { dex_price_usd?: string } };
  const p = Number(j.asset?.dex_price_usd ?? 0);
  if (!(p > 0)) throw new Error("GRAM price unavailable");
  return p;
}

export async function buildPackTransactions(userId: number, orderId: number, wallet: string) {
  const { rows } = await sql`SELECT coins, status FROM pack_orders WHERE id = ${orderId} AND user_id = ${userId}`;
  const order = rows[0];
  if (!order) throw new Error("Order not found");
  if (order["status"] !== "prepared") throw new Error("Order already used");
  const coins = order["coins"] as Array<{ master: string; symbol: string; gram: number }>;

  const market = new Map((await getMarketCoins()).map((c) => [c.master, c]));
  const gramUsd = await tonPriceUsd();
  const net = process.env["TON_NETWORK"] === "testnet" ? "testnet." : "";
  const client = new TonClient({ endpoint: `https://${net}toncenter.com/api/v2/jsonRPC`, apiKey: process.env["TONCENTER_API_KEY"] });
  const router = client.open(new DEX.v1.Router());
  const proxyTon = new pTON.v1();

  const messages: Array<{ address: string; amount: string; payload?: string }> = [];
  for (const c of coins) {
    const m = market.get(c.master);
    if (!m || !(m.priceUsd > 0)) throw new Error(`${c.symbol} is no longer tradable`);
    const expectedUnits = ((c.gram * gramUsd) / m.priceUsd) * 1e9;
    const minAsk = BigInt(Math.floor(expectedUnits * (1 - SLIPPAGE)));
    const p = await router.getSwapTonToJettonTxParams({
      userWalletAddress: wallet,
      proxyTon,
      offerAmount: toNano(c.gram.toFixed(9)),
      askJettonAddress: c.master,
      minAskAmount: minAsk,
    });
    messages.push({ address: p.to.toString(), amount: p.value.toString(), payload: p.body?.toBoc().toString("base64") });
  }
  const txs: Array<{ validUntil: number; messages: typeof messages }> = [];
  for (let i = 0; i < messages.length; i += MESSAGES_PER_TX) {
    txs.push({ validUntil: Math.floor(Date.now() / 1000) + 600, messages: messages.slice(i, i + MESSAGES_PER_TX) });
  }
  await sql`UPDATE pack_orders SET status = 'signing' WHERE id = ${orderId}`;
  return { txs };
}

export async function markPackSent(userId: number, orderId: number, sentBatches: number, totalBatches: number) {
  const status = sentBatches >= totalBatches ? "sent" : "partial";
  await sql`UPDATE pack_orders SET status = ${status} WHERE id = ${orderId} AND user_id = ${userId}`;
}
