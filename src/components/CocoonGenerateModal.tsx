// src/components/CocoonGenerateModal.tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Palette } from "lucide-react";
import { TacticalCTA, TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";

interface Props {
  open: boolean;
  onBack: () => void;
  onSuccess: (imageUrl: string) => void;
  seed?: string;
  imagePrompt?: string;
}

type Step = "intro" | "generating" | "error";

export function CocoonGenerateModal({
  open,
  onBack,
  onSuccess,
  seed,
  imagePrompt,
}: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("intro");
      setErrorMsg(null);
    }
  }, [open]);

  const handleBack = () => {
    setStep("intro");
    setErrorMsg(null);
    onBack();
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setStep("generating");

    try {
      await new Promise((r) => setTimeout(r, 2200));

      if (Math.random() < 0.08) {
        throw new Error("generation_failed");
      }

      const label = encodeURIComponent(
        `HYBRID\n${seed?.slice(-8) || "UNIQUE"}`,
      );
      const fakeImageUrl = `https://placehold.co/512x512/1a1a2e/fbbf24?text=${label}`;

      onSuccess(fakeImageUrl);
      setStep("intro");
    } catch {
      setErrorMsg(
        "Art generation failed. You can try again or go back and keep a standard hybrid unit for free.",
      );
      setStep("error");
      toast.error("Hybrid art generation failed");
    }
  };

  return (
    <TacticalModal
      open={open}
      onClose={step === "generating" ? undefined : handleBack}
      tone="cyan"
      badge="Trophy art"
      badgeIcon={Palette}
      title="Generate hybrid look"
      subtitle="Optional cosmetic art for this hybrid. Not an NFT mint. Payment and Cocoon pipeline are still being connected — this build may use a preview image."
      layer="top"
      align="center"
      footer={
        step === "intro" ? (
          <>
            <TacticalCTA onClick={() => void handleGenerate()}>Generate preview art</TacticalCTA>
            <TacticalCTA variant="ghost" buzz="light" className="text-xs" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" /> Cancel — keep standard hybrid
            </TacticalCTA>
          </>
        ) : step === "error" ? (
          <>
            <TacticalCTA onClick={() => void handleGenerate()}>Try again</TacticalCTA>
            <TacticalCTA variant="ghost" buzz="light" className="text-xs" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" /> Back — keep unit without art
            </TacticalCTA>
          </>
        ) : undefined
      }
    >
      {seed && (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          seed {seed.slice(0, 24)}
          {seed.length > 24 ? "…" : ""}
        </p>
      )}

      {step === "intro" && (
        <TacticalSection label="When live" className="text-center">
          <div className="mt-1 text-lg font-black tac-text">~0.15 GRAM</div>
          <div className="mt-1 text-xs text-muted-foreground">or token equivalent · preview mode free for now</div>
        </TacticalSection>
      )}

      {step === "generating" && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neon-cyan border-t-transparent" />
          <div className="font-bold neon-text-cyan">Generating trophy art…</div>
          <div className="mt-2 text-xs text-muted-foreground">{imagePrompt ? "Using hybrid seed & prompt" : "Preparing preview"}</div>
        </div>
      )}

      {step === "error" && (
        <div className="mt-3 rounded-xl border border-destructive/50 bg-secondary/60 p-4 text-center text-sm text-destructive">
          {errorMsg ?? "Generation failed."}
        </div>
      )}
    </TacticalModal>
  );
}
