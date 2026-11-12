// Shared (browser-safe) AI provider + generation config.
export const AI_PROVIDERS = [
  { id: "lovable", label: "War Room AI (default)", needsKey: false },
  { id: "openai", label: "OpenAI", needsKey: true },
  { id: "xai", label: "xAI / Grok", needsKey: true },
  { id: "openrouter", label: "OpenRouter", needsKey: true },
] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];
export const PLAYER_KEY_PROVIDERS = ["openai", "xai", "openrouter"] as const;

/** Cost in game tokens; using your own key is cheaper since you pay the provider. */
export const GENERATION_COST = { platform: 500, ownKey: 100 } as const;
export const GENERATION_DAILY_CAP = 10;
export const PROMPT_MAX = 300;

const BLOCKED = /\b(nude|naked|nsfw|sex|gore|child|minor|nazi|swastika)\b/i;
export function promptAllowed(p: string): boolean {
  return p.trim().length >= 3 && p.length <= PROMPT_MAX && !BLOCKED.test(p);
}

export function buildArtPrompt(kind: "character" | "weapon" | "map", faction: "wardog" | "warcat", prompt: string) {
  const subject =
    kind === "character"
      ? `a ${faction === "wardog" ? "battle-hardened dog soldier" : "cunning cat soldier"} game character, full body, centered`
      : kind === "weapon"
        ? "a single futuristic game weapon, side view, centered"
        : "a top-down battlefield game map, tileable terrain";
  return `${subject}. ${prompt}. Dark cyber-war style, neon accents, clean silhouette, plain dark background, no text.`;
}
