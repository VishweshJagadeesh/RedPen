import { FlaskConical } from "lucide-react";

export function MockModeBadge({ mode }: { mode: "live" | "mock" }) {
  if (mode !== "mock") return null;
  return (
    <span
      data-demo-id="mock-mode-badge"
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-[oklch(0.75_0.1_80)] bg-medium-bg px-2 py-0.5 text-xs font-medium text-[oklch(0.42_0.1_70)]"
      title="AI_MODE=mock: grading, planning and generation use deterministic sample outputs. No API key needed."
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      Sample data · Mock AI
    </span>
  );
}
