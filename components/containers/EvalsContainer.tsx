"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { EmptyState } from "@/components/shared/States";
import { EvalReportView, type EvalSummary } from "@/components/evals/EvalReportView";
import type { ReviewAgreement } from "@/lib/evals/report";
import { api } from "@/lib/client/api";

export function EvalsContainer({ initial, agreement }: { initial: EvalSummary | null; agreement: ReviewAgreement | null }) {
  const [report, setReport] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setReport(await api<EvalSummary>("/api/evals/run", { method: "POST" }));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          data-demo-id="run-mock-eval"
        >
          <Play /> {busy ? "Running…" : "Run the eval harness now (mock)"}
        </Button>
        <span className="text-sm text-muted-foreground">
          Live model evals run from the command line: <code className="rounded bg-muted px-1">AI_MODE=live npm run eval</code>
        </span>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {report ? <EvalReportView report={report} agreement={agreement} /> : <EmptyState title="No eval report yet" description="Run npm run eval, or use the button above." />}
    </div>
  );
}
