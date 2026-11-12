import { PALETTES, type AssetRecipe } from "@/lib/assets/recipe";

// Renders a procedural asset as lightweight SVG. Asset colors are part of the
// generated artwork (data), not UI theme colors.
export function AssetArt({ recipe, className }: { recipe: AssetRecipe; className?: string }) {
  const [main, dark] = PALETTES[recipe.palette] ?? PALETTES[0];
  const { body, head, gear, mark } = recipe.parts;
  const id = `g${recipe.hash}`;

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={`${recipe.rarity} ${recipe.faction} ${recipe.kind}`}>
      <defs>
        <radialGradient id={id} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={main} stopOpacity="0.35" />
          <stop offset="100%" stopColor={dark} stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill={`url(#${id})`} />
      {recipe.kind === "map" ? (
        <g stroke={main} strokeWidth="1.2" fill="none" opacity="0.85">
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} d={`M0 ${15 + i * 14} Q ${25 + body * 8} ${5 + i * 14 + head * 4} 50 ${15 + i * 14} T 100 ${15 + i * 14}`} />
          ))}
          {Array.from({ length: 3 + gear }).map((_, i) => (
            <circle key={i} cx={15 + ((i * 37 + mark * 11) % 70)} cy={20 + ((i * 23 + body * 13) % 60)} r="4" fill={main} />
          ))}
        </g>
      ) : recipe.kind === "weapon" ? (
        <g transform="rotate(-30 50 50)">
          <rect x={18} y={44} width={58 + gear * 4} height={10 + body} rx="3" fill={main} />
          <rect x={30} y={54} width={9 + head * 2} height={22} rx="2" fill={dark} stroke={main} strokeWidth="1.5" />
          <rect x={70 + gear * 4} y={46} width={10} height={6} fill={dark} stroke={main} />
          {mark > 1 && <circle cx={50} cy={49} r={3} fill={dark} />}
        </g>
      ) : (
        <g>
          <ellipse cx="50" cy="80" rx={26 + body * 3} ry="18" fill={dark} stroke={main} strokeWidth="2" />
          <circle cx="50" cy="44" r={20 + head} fill={main} />
          {recipe.faction === "wardog" ? (
            <>
              <ellipse cx="31" cy={30 - head} rx="7" ry="13" fill={dark} transform="rotate(-20 31 30)" />
              <ellipse cx="69" cy={30 - head} rx="7" ry="13" fill={dark} transform="rotate(20 69 30)" />
              <ellipse cx="50" cy="52" rx="7" ry="5" fill={dark} />
            </>
          ) : (
            <>
              <path d="M30 34 L34 14 L44 28 Z" fill={dark} />
              <path d="M70 34 L66 14 L56 28 Z" fill={dark} />
              <path d="M47 51 L53 51 L50 55 Z" fill={dark} />
            </>
          )}
          <circle cx="42" cy="42" r="3" fill={dark} />
          <circle cx="58" cy="42" r="3" fill={dark} />
          {gear > 0 && <rect x="28" y={24 - head} width="44" height={6 + gear} rx="3" fill={dark} opacity="0.9" />}
          {mark > 1 && <path d="M40 72 L50 66 L60 72 L50 88 Z" fill={main} opacity="0.8" />}
        </g>
      )}
    </svg>
  );
}
