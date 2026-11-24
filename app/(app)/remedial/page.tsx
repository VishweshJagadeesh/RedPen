import Link from "next/link";
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
                    <Badge variant={r.status === "graded" ? "high" : r.status === "assigned" ? "medium" : "secondary"}>{r.status === "assigned" ? "Pending" : r.status === "graded" ? "Graded" : "Draft"}</Badge>
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
