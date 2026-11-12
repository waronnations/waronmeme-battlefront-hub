/** Server-only user record loading + session helpers + wallet link. */

import { z } from "zod";
import { sql } from "@/lib/db.server";
import { readSession } from "@/lib/session.server";

export interface WonUser {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  walletAddress: string | null;
  referralCode: string;
  referredBy: number | null;
}

/** Address-only (legacy / unlink). Prefer WalletLinkSchema for link. */
export const WalletSchema = z.object({
  address: z
    .string()
    .trim()
    .min(48)
    .max(80)
    .regex(
      /^(?:[A-Za-z0-9_-]{48}|-?\d+:[0-9a-fA-F]{64})$/,
      "invalid_ton_address",
    ),
});

/**
 * TON Connect ton_proof payload shape. Signature, payload, domain and
 * freshness are verified in onchain/ton-proof.server.ts.
 */
export const WalletLinkSchema = z.object({
  address: z
    .string()
    .trim()
    .min(48)
    .max(80)
    .regex(
      /^(?:[A-Za-z0-9_-]{48}|-?\d+:[0-9a-fA-F]{64})$/,
      "invalid_ton_address",
    ),
  proof: z.object({
    timestamp: z.number().int().positive(),
    domain: z.object({
      lengthBytes: z.number().int().positive(),
      value: z.string().min(1).max(128),
    }),
    signature: z.string().min(32).max(256),
    payload: z.string().min(8).max(256),
  }),
  publicKey: z.string().min(32).max(128).optional(),
  walletStateInit: z.string().min(8).max(4096).optional(),
});

export type WalletLinkInput = z.infer<typeof WalletLinkSchema>;

export async function sessionUserId(): Promise<number | null> {
  const session = await readSession();
  return session.data?.userId ?? null;
}

export async function requireUserId(): Promise<number> {
  const userId = await sessionUserId();
  if (!userId) throw new Error("unauthorized");
  return userId;
}

export async function loadUser(userId: number): Promise<WonUser | null> {
  const res = await sql`
    SELECT id, telegram_id, username, first_name, last_name, photo_url,
           wallet_address, referral_code, referred_by
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    telegramId: Number(row.telegram_id),
    username: row.username as string | null,
    firstName: row.first_name as string | null,
    lastName: row.last_name as string | null,
    photoUrl: row.photo_url as string | null,
    walletAddress: row.wallet_address as string | null,
    referralCode: row.referral_code as string,
    referredBy: row.referred_by !== null ? Number(row.referred_by) : null,
  };
}

export async function setWallet(
  userId: number,
  address: string | null,
): Promise<WonUser | null> {
  await sql`UPDATE users SET wallet_address = ${address} WHERE id = ${userId}`;
  return loadUser(userId);
}
