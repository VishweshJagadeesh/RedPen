import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/States";
import { ASSESSMENT_TYPE_LABEL, type AssessmentType } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { statusLabel } from "@/components/home/TeacherHome";
import type { AssessmentListItem } from "@/lib/queries/assessments";

export function AssessmentList({ items }: { items: AssessmentListItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No assessments yet" description="Create one to upload a question paper and answer sheets." action={<Button asChild><Link href="/assessments/new">New assessment</Link></Button>} />;
  }
  return (
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
          {items.map((a) => (
            <TR key={a.id} data-demo-id={`assessment-row-${a.id}`}>
              <TD>
                <Link href={a.status === "final" ? `/assessments/${a.id}/results` : a.status === "in_review" ? `/assessments/${a.id}/review` : `/assessments/${a.id}`} className="font-medium hover:underline">
                  {a.title}
                </Link>
              </TD>
              <TD>{a.section}</TD>
              <TD className="hidden sm:table-cell">{ASSESSMENT_TYPE_LABEL[a.type as AssessmentType]}</TD>
              <TD className="whitespace-nowrap">{formatDate(a.date)}</TD>
              <TD className="hidden sm:table-cell">{a.sheets}</TD>
              <TD>
                <Badge variant={a.status === "final" ? "high" : a.status === "sheets_uploaded" ? "default" : "secondary"}>{statusLabel(a.status)}</Badge>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
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
