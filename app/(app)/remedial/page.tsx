import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assessmentHref, gradeActionLabel } from "@/lib/ui/status";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/States";
import { formatDate } from "@/lib/format";
import { listRemedials } from "@/lib/queries/remedial";
import { requireTeacherId } from "@/lib/session";

export const metadata = { title: "Remedial sheets" };

export default async function RemedialListPage() {
  const rows = await listRemedials(await requireTeacherId());
  return (
    <div>
      <PageHeader title="Remedial sheets" description="Targeted practice built from each student's own mistakes." />
      {rows.length === 0 ? (
        <EmptyState title="No remedial sheets yet" description="Create one from an alert or a weak-concept card." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <THead>
              <tr>
                <TH>Sheet</TH>
                <TH>Class</TH>
                <TH>Students</TH>
                <TH>Questions</TH>
                <TH>Created</TH>
                <TH>Status</TH>
                <TH className="w-40" />
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/remedial/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                  </TD>
                  <TD>{r.section}</TD>
                  <TD>{r.students}</TD>
                  <TD>{r.questions}</TD>
                  <TD>{formatDate(r.createdAt)}</TD>
                  <TD>
                    <Badge variant={r.status === "graded" ? "high" : r.status === "assigned" ? "medium" : "secondary"}>{r.status === "assigned" ? "Awaiting answers" : r.status === "graded" ? "Graded" : "Draft"}</Badge>
                  </TD>
                  <TD className="text-right">
                    {r.assessment && (
                      <Button asChild size="sm" variant={r.assessment.status === "final" ? "ghost" : "default"}>
                        <Link href={assessmentHref(r.assessment)} data-demo-id={`grade-remedial-${r.id}`}>
                          <ClipboardCheck /> {gradeActionLabel(r.assessment.status)}
                        </Link>
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
