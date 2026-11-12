// AES-GCM encryption for player-supplied provider keys (Web Crypto, works on Workers).
async function key(): Promise<CryptoKey> {
  const raw = process.env["PROVIDER_KEY_SECRET"];
  if (!raw) throw new Error("PROVIDER_KEY_SECRET is not set");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function open(sealed: string): Promise<string> {
  const [iv, ct] = sealed.split(".");
  if (!iv || !ct) throw new Error("Bad ciphertext");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct));
  return new TextDecoder().decode(pt);
}
