import { prisma } from "../db/prisma";
import { bandFor } from "../grading/confidence";
import type { ReviewAgreement } from "./report";

/** Override statistics from every reviewed answer in the database (feeds calibration over time). */
export async function reviewAgreement(): Promise<ReviewAgreement> {
  const rows = await prisma.answerGrade.findMany({ where: { status: { not: "pending_review" } }, select: { status: true, confidence: true } });
  const byBand = ["high", "medium", "low"].map((band) => {
    const rs = rows.filter((r) => bandFor(r.confidence) === band);
    const o = rs.filter((r) => r.status === "overridden").length;
    return { band, reviewed: rs.length, overridden: o, pct: rs.length ? Math.round((o / rs.length) * 1000) / 10 : 0 };
  });
  const overridden = rows.filter((r) => r.status === "overridden").length;
  return { reviewed: rows.length, overridden, overriddenPct: rows.length ? Math.round((overridden / rows.length) * 1000) / 10 : 0, byBand };
}
