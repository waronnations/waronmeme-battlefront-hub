import { TacticalModal, TacticalCTA } from "@/components/ui/TacticalModal";
// src/components/payments/PaymentModal.tsx
import {
  Loader2,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
} from "lucide-react";

import { actionLabel, type PaidActionId } from "@/lib/payments";

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
};

/** Local button — the project has no shadcn ui/ primitives. */
function Btn({
  children,
  onClick,
  variant = "primary",
  className = "",
}: BtnProps) {
  return <TacticalCTA onClick={onClick} variant={variant === "primary" ? "deploy" : "ghost"} className={className}>{children}</TacticalCTA>;
}

export type PaymentPhase =
  | "connect"
  | "creating"
  | "awaiting_wallet"
  | "verifying"
  | "success"
  | "error";

export interface PaymentModalState {
  action: PaidActionId;
  phase: PaymentPhase;
  /** @deprecated kept optional for older callers — UI never shows TON */
  amountTon?: number;
  message?: string;
}

const PHASE_COPY: Record<PaymentPhase, { title: string; body: string }> = {
  connect: {
    title: "Connect your wallet",
    body: "Link a TON wallet once. It stays connected until you disconnect. You still pay with $WARDOG or $WARCAT — never native GRAM.",
  },
  creating: {
    title: "Preparing",
    body: "Opening a secure authorization for this action…",
  },
  awaiting_wallet: {
    title: "Confirm in your wallet",
    body: "Approve in your wallet if prompted. Spend is always $WARDOG or $WARCAT in-game.",
  },
  verifying: {
    title: "Authorizing",
    body: "Binding this action to your connected wallet…",
  },
  success: {
    title: "Wallet authorized",
    body: "Continue — choose $WARDOG or $WARCAT to complete the purchase.",
  },
  error: {
    title: "Authorization failed",
    body: "Something went wrong.",
  },
};

export function PaymentModal({
  state,
  address,
  onConnect,
  onRetry,
  onClose,
  onDone,
  onOpenApiKey,
}: {
  state: PaymentModalState | null;
  address: string;
  onConnect: () => void | Promise<void>;
  onRetry: () => void;
  onClose: () => void;
  onDone: () => void;
  onOpenApiKey: () => void;
}) {
  const busy =
    state?.phase === "creating" ||
    state?.phase === "awaiting_wallet" ||
    state?.phase === "verifying";

  if (!state) return null;
  return (
    <TacticalModal open={Boolean(state)} onClose={busy ? undefined : onClose} title={PHASE_COPY[state.phase].title} badge="Authorization" tone="cyan">
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary">
                {state.phase === "success" ? (
                  <CheckCircle2 className="size-5" />
                ) : state.phase === "error" ? (
                  <AlertTriangle className="size-5" />
                ) : busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Wallet className="size-5" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold uppercase tracking-wide">
                  {PHASE_COPY[state.phase].title}
                </h3>
                <p className="mt-1 text-sm text-foreground">
                  {state.message ?? PHASE_COPY[state.phase].body}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-border bg-secondary p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {actionLabel(state.action)}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-neon-amber">
                  $WARDOG / $WARCAT
                </span>
              </div>
              {address ? (
                <div className="mt-2 flex items-center justify-between text-xs text-foreground">
                  <span>Connected</span>
                  <span className="font-mono">
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-foreground">
                  Wallet not connected yet
                </div>
              )}
              <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">
                No native GRAM is charged. After authorization, the
                cost is taken from your chosen in-game token.
              </p>
            </div>

            <div className="space-y-2">
              {state.phase === "connect" && (
                <Btn onClick={() => void onConnect()}>
                  <Wallet className="mr-2 size-4" /> Connect Wallet
                </Btn>
              )}
              {state.phase === "success" && (
                <Btn onClick={onDone}>Continue</Btn>
              )}
              {state.phase === "error" && (
                <>
                  <Btn onClick={onRetry}>Try again</Btn>
                  <Btn variant="outline" onClick={onOpenApiKey}>
                    <KeyRound className="mr-2 size-4" /> TON API key (optional)
                  </Btn>
                </>
              )}
              {!busy && state.phase !== "success" && (
                <Btn variant="ghost" onClick={onClose}>
                  Cancel
                </Btn>
              )}
            </div>
    </TacticalModal>
  );
}
