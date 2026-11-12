// src/components/nations/NationsList.tsx
import {
  Flag,
  RefreshCw,
  Crown,
  LogOut,
  Tag,
  ArrowRightLeft,
  AlertTriangle,
  Search,
  Shield,
  Zap,
  Users,
  Trophy,
} from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { getReputationTier, NATION_BUFFS } from "@/lib/constants";
import { TraitorBadge, OfficerBadge } from "./badges";
import type { Nation, MyNation } from "./use-nations-panel";

function FactionBadge({ faction }: { faction?: "wardog" | "warcat" | null }) {
  if (faction === "wardog") {
    return (
      <span className="hud-chip text-destructive">
        WARDOG
      </span>
    );
  }
  if (faction === "warcat") {
    return (
      <span className="hud-chip text-neon-cyan">
        WARCAT
      </span>
    );
  }
  return null;
}

export function NationsList({
  loading,
  load,
  myNation,
  isLeader,
  handleLeave,
  leaving,
  setShowListModal,
  handleUnlist,
  unlisting,
  openTransferModal,
  search,
  setSearch,
  filtered,
  openDetails,
  redeeming,
  handleRedeemTraitor,
  onInvite,
}: {
  loading: boolean;
  load: () => Promise<void>;
  myNation: MyNation | null;
  isLeader: boolean;
  handleLeave: () => Promise<void>;
  leaving: boolean;
  setShowListModal: (v: boolean) => void;
  handleUnlist: () => Promise<void>;
  unlisting: boolean;
  openTransferModal: () => Promise<void>;
  search: string;
  setSearch: (v: string) => void;
  filtered: Nation[];
  openDetails: (nationId: number) => Promise<void>;
  redeeming: boolean;
  handleRedeemTraitor: (pay: boolean) => Promise<void>;
  onInvite?: () => void;
}) {
  const rep = myNation
    ? getReputationTier(myNation.reputation || 0)
    : null;

  const activeBuff =
    myNation?.activeBuff &&
    NATION_BUFFS[myNation.activeBuff as keyof typeof NATION_BUFFS]
      ? NATION_BUFFS[myNation.activeBuff as keyof typeof NATION_BUFFS]
      : null;

  return (
    <>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-neon-cyan" />
          <h2 className="hud-title">
            Nations
          </h2>
        </div>
        <button
          onClick={() => {
            void load();
            haptic("light");
          }}
          disabled={loading}
          className="min-h-11 min-w-11 hud-card p-2 text-muted-foreground hover:bg-transparent disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {myNation ? (
        <div
          className={cn(
            "holo-panel holo-scan p-4",
            myNation.isTraitor
              ? "border-border"
              : "border-border",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center hud-card text-2xl">
                {myNation.emblem || "🏳️"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-base font-black text-foreground">
                    {myNation.name}
                  </span>
                  {myNation.myRole === "leader" && (
                    <Crown className="h-4 w-4 text-neon-amber" />
                  )}
                  {myNation.myRole === "officer" && <OfficerBadge />}
                  {myNation.isTraitor && <TraitorBadge />}
                  <FactionBadge faction={myNation.faction} />
                  {myNation.isProtected && (
                    <span className="hud-chip text-neon-green">
                      <Shield className="h-2.5 w-2.5" />
                      Protected
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  [{myNation.tag}] · {myNation.memberCount} members
                </div>
                {rep && (
                  <div className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground">
                    {rep.tier} · {myNation.reputation || 0} rep
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="min-h-11 min-w-11 rounded-lg border border-border bg-transparent px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:border-border hover:text-foreground disabled:opacity-50"
            >
              {leaving ? (
                "..."
              ) : (
                <span className="flex items-center gap-1">
                  <LogOut className="h-3 w-3" />
                  Leave
                </span>
              )}
            </button>
          </div>

          {activeBuff && (
            <div className="mt-3 flex items-center gap-2 hud-card p-3">
              <Zap className="h-4 w-4 text-neon-amber" />
              <div className="text-xs">
                <span className="font-bold text-foreground">{activeBuff.name}</span>
                <span className="text-muted-foreground"> — {activeBuff.desc}</span>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="hud-card p-3">
              <div className="hud-label">
                Vault
              </div>
              <div className="text-xs font-mono font-black neon-text-cyan">
                {Math.floor(myNation.vaultWardog || 0)} /{" "}
                {Math.floor(myNation.vaultWarcat || 0)}
              </div>
            </div>
            <div className="hud-card p-3">
              <div className="hud-label">
                Weekly
              </div>
              <div className="text-xs font-mono font-black neon-text-cyan">
                {Math.floor(myNation.myWeeklyGlory || 0)}
              </div>
            </div>
            <div className="hud-card p-3">
              <div className="hud-label">
                Role
              </div>
              <div className="text-xs font-bold capitalize text-foreground">
                {myNation.myRole}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {onInvite && (
              <button
                onClick={() => {
                  onInvite();
                  haptic("medium");
                }}
                className="min-h-11 min-w-11 rounded-lg border border-border bg-transparent px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:border-border"
              >
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Invite
                </span>
              </button>
            )}

            {isLeader && !myNation.isDefault && (
              <>
                {myNation.listedPrice ? (
                  <button
                    onClick={handleUnlist}
                    disabled={unlisting}
                    className="min-h-11 min-w-11 rounded-lg border border-border bg-transparent px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:border-border disabled:opacity-50"
                  >
                    {unlisting ? "..." : "Unlist"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowListModal(true)}
                    className="min-h-11 min-w-11 rounded-lg border border-border bg-transparent px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:border-border"
                  >
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      List for Sale
                    </span>
                  </button>
                )}
                <button
                  onClick={openTransferModal}
                  className="min-h-11 min-w-11 rounded-lg border border-border bg-transparent px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:border-border"
                >
                  <span className="flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    Transfer
                  </span>
                </button>
              </>
            )}
          </div>

          {myNation.listedPrice && (
            <div className="mt-2 text-xs text-muted-foreground">
              Currently listed for{" "}
              <span className="font-mono font-black neon-text-amber">{myNation.listedPrice}</span>{" "}
              tokens
            </div>
          )}

          {myNation.isTraitor && (
            <div className="mt-3 hud-card p-3 text-xs text-foreground">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>
                  You are marked as a{" "}
                  <span className="font-bold text-destructive">Traitor</span>.
                  Rewards reduced. Cannot claim empty countries until redeemed.
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void handleRedeemTraitor(true)}
                  disabled={redeeming}
                  className="hit-cta cta-amber px-2.5 py-1 text-[0.65rem] font-bold text-primary-foreground hover:bg-transparent disabled:opacity-50"
                >
                  {redeeming ? "..." : "Pay to Redeem"}
                </button>
                <button
                  onClick={() => void handleRedeemTraitor(false)}
                  disabled={redeeming}
                  className="min-h-11 min-w-11 rounded-lg border border-border px-2.5 py-1 text-[0.65rem] font-bold text-foreground hover:border-border disabled:opacity-50"
                >
                  Wait 7 days
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="holo-panel p-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            You are not in a nation yet. Claim a country or join one below.
          </p>
        </div>
      )}

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nations..."
          className="hud-input min-h-11 w-full py-2.5 pl-10 pr-4 text-sm"
        />
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading nations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No nations found
          </div>
        ) : (
          filtered.map((n) => {
            const isMine = myNation?.id === n.id;
            const canClaim =
              !n.isDefault &&
              n.memberCount === 0 &&
              (n.leaderId == null || n.leaderId === undefined);
            const nRep = getReputationTier(n.reputation || 0);

            return (
              <button
                key={n.id}
                onClick={() => void openDetails(n.id)}
                className={cn(
                  "hud-card min-h-11 flex w-full items-center gap-3 p-3 text-left transition-colors hover:border-neon-cyan/40",
                  isMine
                    ? "hud-card-active"
                    : "border-border",
                )}
              >
                <div className="min-h-11 min-w-11 grid h-10 w-10 shrink-0 place-items-center hud-card text-xl">
                  {n.emblem || "🏳️"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold text-foreground">
                      {n.name}
                    </span>
                    {n.isDefault && (
                      <span className="hud-chip text-foreground">
                        Faction Hub
                      </span>
                    )}
                    <FactionBadge faction={n.faction} />
                    {n.isProtected && (
                      <Shield className="h-3 w-3 shrink-0 text-neon-green" />
                    )}
                  </div>
                  <div className="text-[0.65rem] text-muted-foreground">
                    [{n.tag}] · {n.memberCount} members
                    {n.totalGlory > 0 &&
                      ` · ${Math.floor(n.totalGlory).toLocaleString()} glory`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {canClaim ? (
                    <span className="hud-chip text-neon-green">
                      Claim
                    </span>
                  ) : isMine ? (
                    <span className="hud-chip text-foreground">
                      Yours
                    </span>
                  ) : n.listedPrice ? (
                    <span className="hud-chip text-foreground">
                      {n.listedPrice} ◎
                    </span>
                  ) : (
                    <span className="text-[0.6rem] font-bold uppercase text-muted-foreground">
                      {nRep.tier}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
