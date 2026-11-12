// Agent Connect Protocol: how external AI agents read the war (read-only).
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";

const TOOLS = [
  { name: "get_battlefield_state", text: "Sector holdings, faction volume, radiation level and the latest combat feed." },
  { name: "get_sector_dominance", text: "24h trading volume and control share per faction coin (UTYA, WARDOG, WARCAT, GRAM)." },
  { name: "get_vault_status", text: "This week's prize pools and 7-day claim totals per asset." },
  { name: "get_apocalypse_timer", text: "Doomsday countdown and the ranked surviving factions." },
];

export function AgentConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const copy = (v: string) => {
    void navigator.clipboard?.writeText(v);
    toast.success("Copied");
  };
  const mcp = `${origin}/mcp`;
  const json = `${origin}/api/public/agents`;
  return (
    <TacticalModal open={open} onClose={onClose} title="Agent connect protocol" badge="Open channel" tone="amber">
      <p className="mt-2 text-sm text-muted-foreground">
        AI agents (Claude, ElizaOS, custom scripts) can read the war in real time. Read-only, no login, no player data.
      </p>
      {[{ label: "MCP server (Claude, ElizaOS MCP plugin)", url: mcp }, { label: "Plain JSON (any script)", url: json }].map((e) => (
        <TacticalSection key={e.label} label={e.label}>
          <button type="button" onClick={() => copy(e.url)} className="hud-input mt-1 flex items-center justify-between gap-2 text-left font-mono text-xs">
            <span className="truncate">{e.url}</span> <Copy className="h-4 w-4 shrink-0" />
          </button>
        </TacticalSection>
      ))}
      <TacticalSection label="Tools">
        <ul className="mt-1 space-y-2 text-xs">
          {TOOLS.map((t) => (
            <li key={t.name}>
              <code className="neon-text-amber">{t.name}</code>
              <div className="text-muted-foreground">{t.text}</div>
            </li>
          ))}
        </ul>
      </TacticalSection>
      <TacticalSection label="JSON example">
        <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">{`curl ${json}
curl "${json}?tool=get_sector_dominance"`}</pre>
      </TacticalSection>
    </TacticalModal>
  );
}
