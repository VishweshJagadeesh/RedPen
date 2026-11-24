"use client";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MatchSheetView {
  id: string;
  pageCount: number;
  firstPageUrl: string | null;
  detectedName: string | null;
  detectedRoll: number | null;
  studentId: string | null;
  confidence: number;
  reason: string;
  needsReview: boolean;
  graded: boolean;
}

export interface SheetMatcherProps {
  sheets: MatchSheetView[];
  roster: { id: string; name: string; rollNumber: number }[];
  missingStudents: { id: string; name: string; rollNumber: number }[];
  busy: boolean;
  error: string | null;
  confirmLabel: string;
  onChange: (sheetId: string, studentId: string | null) => void;
  onRemove: (sheetId: string) => void;
  onConfirm: () => void;
}

/** Step 4: which sheet belongs to which student, read from page 1. The teacher fixes mismatches. */
export function SheetMatcher({ sheets, roster, missingStudents, busy, error, confirmLabel, onChange, onRemove, onConfirm }: SheetMatcherProps) {
  const pages = sheets.reduce((s, x) => s + x.pageCount, 0);
  const unmatched = sheets.filter((s) => !s.studentId);
  const review = sheets.filter((s) => s.studentId && s.needsReview);
  const counts = new Map<string, number>();
  for (const s of sheets) if (s.studentId) counts.set(s.studentId, (counts.get(s.studentId) ?? 0) + 1);
  const ordered = [...sheets].sort((a, b) => Number(b.needsReview || !b.studentId) - Number(a.needsReview || !a.studentId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm" data-demo-id="match-summary">
        <Badge variant="secondary">{sheets.length} sheets</Badge>
        <Badge variant="secondary">{pages} pages</Badge>
        <Badge variant={unmatched.length ? "low" : "high"}>{unmatched.length} unmatched</Badge>
        <Badge variant={review.length ? "medium" : "high"}>{review.length} to check</Badge>
        {missingStudents.length > 0 && <Badge variant="outline">{missingStudents.length} students without a sheet</Badge>}
      </div>
      <Table>
        <THead>
          <tr>
            <TH>Sheet</TH>
            <TH>Read from page 1</TH>
            <TH>Student</TH>
            <TH>Match</TH>
            <TH />
          </tr>
        </THead>
        <TBody>
          {ordered.map((s) => {
            const dup = s.studentId && (counts.get(s.studentId) ?? 0) > 1;
            return (
              <TR key={s.id} data-demo-id={`match-row-${s.id}`} className={cn((s.needsReview || dup) && "bg-medium-bg/40")}>
                <TD>
                  <div className="flex items-center gap-2">
                    {s.firstPageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.firstPageUrl} alt="" className="h-12 w-9 rounded border object-cover object-top" />
                    ) : (
                      <div className="h-12 w-9 rounded border bg-muted" />
                    )}
                    <span className="text-xs text-muted-foreground">{s.pageCount} pg</span>
                  </div>
                </TD>
                <TD className="text-sm">
                  <div>{s.detectedName ?? <span className="italic text-muted-foreground">name unreadable</span>}</div>
                  <div className="text-xs text-muted-foreground">Roll {s.detectedRoll ?? "?"}</div>
                </TD>
                <TD className="min-w-[200px]">
                  <NativeSelect value={s.studentId ?? ""} disabled={busy || s.graded} onChange={(e) => onChange(s.id, e.target.value || null)} data-demo-id={`match-select-${s.id}`}>
                    <option value="">— choose student —</option>
                    {roster.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.rollNumber}. {st.name}
                      </option>
                    ))}
                  </NativeSelect>
                </TD>
                <TD className="text-xs">
                  {dup ? (
                    <span className="flex items-center gap-1 text-low">
                      <AlertTriangle className="h-3.5 w-3.5" /> Same student as another sheet
                    </span>
                  ) : s.needsReview ? (
                    <span className="flex items-center gap-1 text-[oklch(0.45_0.11_70)]">
                      <AlertTriangle className="h-3.5 w-3.5" /> {s.reason}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-high">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {s.reason}
                    </span>
                  )}
                </TD>
                <TD>
                  {!s.graded && (
                    <button className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remove sheet" onClick={() => onRemove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {missingStudents.length > 0 && (
        <p className="text-xs text-muted-foreground">
          No sheet yet for: {missingStudents.map((s) => `${s.rollNumber}. ${s.name}`).join(", ")}. They will be recorded as absent.
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={onConfirm} disabled={busy || unmatched.length > 0 || sheets.length === 0} data-demo-id="confirm-matches">
        {confirmLabel}
      </Button>
    </div>
  );
}
