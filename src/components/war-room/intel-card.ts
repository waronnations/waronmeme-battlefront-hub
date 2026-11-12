// "Battle Intel" dossier image, 1080×1920 (Telegram Stories), drawn on a canvas.
export type IntelData = {
  callsign: string;
  referralLink: string;
  radiation: number;
  doomsday: string;
  sectors: { symbol: string; dominance: number; volume24hUsd: number }[];
  apex: string | null;
};

const fmtUsd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);

function css(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export async function renderIntelCard(d: IntelData): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const bg = css("--background", "#0b0e14");
  const fg = css("--foreground", "#e8f6ff");
  const cyan = css("--neon-cyan", "#00f0ff");
  const amber = css("--neon-amber", "#ffb800");
  const danger = css("--destructive", "#ff3b4e");
  const muted = css("--muted-foreground", "#7d8aa0");

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // scan lines
  g.globalAlpha = 0.06;
  g.fillStyle = cyan;
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  g.globalAlpha = 1;
  // frame
  g.strokeStyle = cyan;
  g.lineWidth = 6;
  g.strokeRect(48, 48, W - 96, H - 96);
  g.fillStyle = amber;
  for (const [x, y] of [[48, 48], [W - 108, 48], [48, H - 108], [W - 108, H - 108]] as const) g.fillRect(x, y, 60, 60);

  const font = (w: number, s: number) => `${w} ${s}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.textBaseline = "top";
  g.fillStyle = danger;
  g.font = font(900, 40);
  g.fillText("CLASSIFIED // BATTLE INTEL", 110, 140);
  g.fillStyle = fg;
  g.font = font(900, 96);
  g.fillText("WAR ON MEMES", 110, 210);
  g.fillStyle = muted;
  g.font = font(700, 36);
  g.fillText("FIELD OPERATIVE", 110, 360);
  g.fillStyle = amber;
  g.font = font(900, 84);
  g.fillText(d.callsign.toUpperCase().slice(0, 18), 110, 410);

  // radiation
  g.fillStyle = muted;
  g.font = font(700, 36);
  g.fillText("RADIATION", 110, 580);
  g.fillStyle = d.radiation >= 50 ? danger : cyan;
  g.font = font(900, 140);
  g.fillText(`${d.radiation}%`, 110, 630);
  g.strokeStyle = muted;
  g.lineWidth = 4;
  g.strokeRect(110, 800, W - 220, 40);
  g.fillRect(110, 800, ((W - 220) * Math.min(100, d.radiation)) / 100, 40);

  g.fillStyle = muted;
  g.font = font(700, 36);
  g.fillText("DOOMSDAY IN", 110, 900);
  g.fillStyle = fg;
  g.font = font(900, 72);
  g.fillText(d.doomsday, 110, 950);

  // sectors
  g.fillStyle = muted;
  g.font = font(700, 36);
  g.fillText("SECTOR DOMINANCE · 24H", 110, 1090);
  d.sectors.forEach((s, i) => {
    const y = 1150 + i * 110;
    g.fillStyle = fg;
    g.font = font(900, 52);
    g.fillText(`$${s.symbol}`, 110, y);
    g.fillStyle = muted;
    g.font = font(700, 36);
    g.fillText(fmtUsd(s.volume24hUsd), 560, y + 10);
    g.fillStyle = i % 2 ? amber : cyan;
    g.fillRect(110, y + 66, Math.max(6, (W - 220) * s.dominance), 14);
  });

  if (d.apex) {
    g.fillStyle = amber;
    g.font = font(900, 44);
    g.fillText(`APEX SURVIVOR: $${d.apex}`, 110, 1620);
  }
  g.fillStyle = cyan;
  g.font = font(700, 30);
  g.fillText("ENLIST:", 110, 1700);
  g.fillStyle = fg;
  g.fillText(d.referralLink.replace(/^https:\/\//, ""), 110, 1745);

  return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("render failed"))), "image/png"));
}

/** Native share sheet with the image when available, otherwise a download. */
export async function shareIntel(blob: Blob, text: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], "battle-intel.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch {
      /* cancelled → fall back to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "battle-intel.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
