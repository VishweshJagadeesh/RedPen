import fs from "node:fs/promises";
import path from "node:path";
import { EvalsContainer } from "@/components/containers/EvalsContainer";
import type { EvalSummary } from "@/components/evals/EvalReportView";
import { PageHeader } from "@/components/shared/States";
import { reviewAgreement } from "@/lib/evals/agreement";

export const metadata = { title: "Evals" };

async function latestReport(): Promise<EvalSummary | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "evals/reports/latest.json"), "utf8")) as EvalSummary;
  } catch {
    return null;
  }
}

export default async function EvalsPage() {
  const [report, agreement] = await Promise.all([latestReport(), reviewAgreement()]);
  return (
    <div>
      <PageHeader
        title="Evals"
        description="How well grading agrees with teachers, whether confidence is calibrated, how much lands on the teacher's desk, and whether alerts and plans hold up. Reports are written to evals/reports/."
      />
      <EvalsContainer initial={report} agreement={agreement} />
    </div>
  );
}
