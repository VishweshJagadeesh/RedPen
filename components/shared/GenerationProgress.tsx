import { Check, Circle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
}

export interface GenerationProgressProps {
  title: string;
  steps: GenerationStep[];
  /** 0–100 */
  percent: number;
  elapsedSeconds: number;
  hint?: string;
  demoId?: string;
}

/** A step list with a progress bar for long AI jobs (reteach plans). Presentational: the container drives it. */
export function GenerationProgress({ title, steps, percent, elapsedSeconds, hint, demoId = "generation-progress" }: GenerationProgressProps) {
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4" data-demo-id={demoId} aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium">{title}</div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {done} of {steps.length} steps · {elapsedSeconds}s
        </div>
      </div>
      <Progress value={percent} label={title} />
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3 text-sm" data-demo-id={`progress-step-${s.id}`} data-status={s.status}>
            <span className="mt-0.5 shrink-0">
              {s.status === "done" ? (
                <Check className="h-4 w-4 text-high" />
              ) : s.status === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : s.status === "error" ? (
                <XCircle className="h-4 w-4 text-low" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50" />
              )}
            </span>
            <span className="min-w-0">
              <span className={cn(s.status === "pending" && "text-muted-foreground", s.status === "active" && "font-medium")}>{s.label}</span>
              {s.detail && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
