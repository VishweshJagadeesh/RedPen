import Link from "next/link";
import { Plus, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/States";
import { ShareWorkButton } from "@/components/shared/ShareWorkButton";
import { ASSESSMENT_TYPE_LABEL, type AssessmentType } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { assessmentHref, assessmentStatus } from "@/lib/ui/status";
import type { AssessmentListItem } from "@/lib/queries/assessments";
import { cn } from "@/lib/utils";

export const ASSESSMENT_FILTERS = [
  { id: "all", label: "All" },
  { id: "tests", label: "Tests" },
  { id: "homework", label: "Homework" },
  { id: "followups", label: "Exit tickets & remedial" },
  { id: "not_handed_out", label: "Not handed out" },
  { id: "drafts", label: "Drafts" },
] as const;
export type AssessmentFilter = (typeof ASSESSMENT_FILTERS)[number]["id"];

export function matchesFilter(a: AssessmentListItem, f: AssessmentFilter) {
  switch (f) {
    case "tests":
      return ["weekly_test", "periodic_test", "term_exam"].includes(a.type);
    case "homework":
      return a.type === "homework";
    case "followups":
      return a.type === "exit_ticket" || a.type === "remedial";
    case "not_handed_out":
      return !a.handedOut && a.status === "questions_ready";
    case "drafts":
      return a.status === "draft";
    default:
      return true;
  }
}


export function AssessmentList({ items, filter = "all" }: { items: AssessmentListItem[]; filter?: AssessmentFilter }) {
  if (items.length === 0) {
    return <EmptyState title="No assessments yet" description="Create one to upload a question paper and answer sheets." action={<Button asChild><Link href="/assessments/new">New assessment</Link></Button>} />;
  }
  const visible = items.filter((a) => matchesFilter(a, filter));
  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1" aria-label="Filter assessments">
        {ASSESSMENT_FILTERS.map((f) => {
          const count = items.filter((a) => matchesFilter(a, f.id)).length;
          if (count === 0 && f.id !== "all" && f.id !== filter) return null;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/assessments" : `/assessments?filter=${f.id}`}
              data-demo-id={`assessment-filter-${f.id}`}
              aria-current={filter === f.id ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1 text-xs", filter === f.id ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}
            >
              {f.label} ({count})
            </Link>
          );
        })}
      </nav>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead>
            <tr>
              <TH>Assessment</TH>
              <TH>Class</TH>
              <TH className="hidden sm:table-cell">Type</TH>
              <TH>Date</TH>
              <TH className="hidden sm:table-cell">Sheets</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {visible.map((a) => {
              const st = assessmentStatus(a);
              return (
                <TR key={a.id} data-demo-id={`assessment-row-${a.id}`}>
                  <TD>
                    <Link href={assessmentHref(a)} className="font-medium hover:underline">
                      {a.title}
                    </Link>
                    {st.tag && (
                      <div className="mt-1.5 flex flex-wrap items-start gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/assessments/${a.id}/print`} target="_blank" data-demo-id={`print-copy-${a.id}`}>
                            <Printer /> Print
                          </Link>
                        </Button>
                        <ShareWorkButton assessmentId={a.id} title={a.title} />
                      </div>
                    )}
                  </TD>
                  <TD>{a.section}</TD>
                  <TD className="hidden sm:table-cell">{ASSESSMENT_TYPE_LABEL[a.type as AssessmentType]}</TD>
                  <TD className="whitespace-nowrap">{formatDate(a.date)}</TD>
                  <TD className="hidden sm:table-cell">{a.sheets}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {st.tag && (
                        <Badge variant="outline" data-demo-id={`not-handed-out-${a.id}`}>
                          {st.tag}
                        </Badge>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  Nothing here.
                </td>
              </tr>
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

export function NewAssessmentButton() {
  return (
    <Button asChild data-demo-id="new-assessment">
      <Link href="/assessments/new">
        <Plus /> New assessment
      </Link>
    </Button>
  );
}
