import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { ConfidenceBand } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const META: Record<ConfidenceBand, { label: string; Icon: typeof ShieldCheck }> = {
  high: { label: "High", Icon: ShieldCheck },
  medium: { label: "Medium", Icon: ShieldQuestion },
  low: { label: "Low", Icon: ShieldAlert },
};

/** Confidence is always shown with a label, an icon and a colour — never colour alone. */
export function ConfidenceBadge({ band, score, className, showScore = true }: { band: ConfidenceBand; score?: number; className?: string; showScore?: boolean }) {
  const { label, Icon } = META[band];
  return (
    <Badge variant={band} className={cn("gap-1", className)} data-confidence={band}>
      <Icon aria-hidden />
      <span>{label}</span>
      {showScore && score !== undefined && <span className="tabular-nums opacity-80">· {score.toFixed(2)}</span>}
    </Badge>
  );
}

export function bandTextClass(band: ConfidenceBand) {
  return band === "high" ? "text-high" : band === "medium" ? "text-[oklch(0.45_0.11_70)]" : "text-low";
}
