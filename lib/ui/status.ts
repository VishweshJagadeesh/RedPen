/** Assessment status as teachers see it (one place, so lists, Home and headers agree). */
export interface StatusView {
  label: string;
  variant: "default" | "secondary" | "high" | "outline";
  /** Extra tag, e.g. "Not handed out". */
  tag?: string;
}

const LABEL: Record<string, string> = {
  draft: "Draft",
  questions_ready: "Awaiting sheets",
  sheets_uploaded: "Ready to grade",
  grading: "Grading",
  in_review: "In review",
  final: "Final",
};

export function statusLabel(s: string) {
  return LABEL[s] ?? s;
}

export function assessmentStatus(a: { status: string; handedOut?: boolean; sheets?: number }): StatusView {
  if (a.status === "questions_ready" && a.handedOut === false) return { label: "Ready to grade", variant: "default", tag: "Not handed out" };
  if (a.status === "questions_ready" && (a.sheets ?? 0) > 0) return { label: "Matching sheets", variant: "secondary" };
  if (a.status === "final") return { label: "Final", variant: "high" };
  if (a.status === "sheets_uploaded") return { label: "Ready to grade", variant: "default" };
  return { label: statusLabel(a.status), variant: "secondary" };
}

/** The page that continues an assessment from where it is: upload/match, grading, review or results. */
export function assessmentHref(a: { id: string; status: string }) {
  if (a.status === "final") return `/assessments/${a.id}/results`;
  if (a.status === "in_review") return `/assessments/${a.id}/review`;
  if (a.status === "grading") return `/assessments/${a.id}/grade`;
  return `/assessments/${a.id}`;
}

/** Action label for an assigned remedial sheet / exit ticket, by the state of its assessment. */
export function gradeActionLabel(status: string | null | undefined) {
  if (status === "final") return "Results";
  if (status === "in_review") return "Review grades";
  if (status === "grading" || status === "sheets_uploaded") return "Continue grading";
  return "Grade responses";
}
