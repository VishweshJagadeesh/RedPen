import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/States";
import { FLAG_STATUS_LABEL, FLAG_TYPE_LABEL, type FlagStatus, type FlagType } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export interface FlagListItem {
  id: string;
  studentId: string;
  studentName: string;
  section: string;
  type: string;
  status: string;
  createdAt: string;
  summary: string;
}

const STATUS_VARIANT: Record<FlagStatus, "low" | "medium" | "high" | "secondary"> = {
  open: "low",
  action_taken: "medium",
  improving: "high",
  resolved: "secondary",
};

/** "Needs attention": every alert with the one-line reason it fired. */
export function FlaggedStudentsList({ flags, showSection = true, emptyText = "No students need attention right now." }: { flags: FlagListItem[]; showSection?: boolean; emptyText?: string }) {
  if (flags.length === 0) return <EmptyState title={emptyText} description="Alerts fire on sudden drops, missed submissions and concept regressions, and always explain why." />;
  return (
    <ul className="divide-y rounded-xl border bg-card" data-demo-id="flagged-students-list">
      {flags.map((f) => (
        <li key={f.id}>
          <Link href={`/alerts/${f.id}`} className="flex items-start gap-3 p-4 hover:bg-muted/40" data-demo-id={`flag-row-${f.studentName.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.studentName}</span>
                {showSection && <span className="text-xs text-muted-foreground">Class {f.section}</span>}
                <Badge variant="outline">{FLAG_TYPE_LABEL[f.type as FlagType]}</Badge>
                <Badge variant={STATUS_VARIANT[f.status as FlagStatus]}>{FLAG_STATUS_LABEL[f.status as FlagStatus]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{f.summary}</p>
              <div className="mt-1 text-xs text-muted-foreground">Flagged {formatDate(f.createdAt)}</div>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
