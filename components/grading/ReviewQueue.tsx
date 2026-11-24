"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCheck, CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, Kbd, Progress } from "@/components/ui/misc";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { EmptyState } from "@/components/shared/States";
import { AnswerReviewCard } from "./AnswerReviewCard";
import type { ReviewItem } from "@/lib/queries/review";
import { formatMarks } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ReviewFilter = "needs_review" | "pending" | "all";

export interface ReviewQueueProps {
  items: ReviewItem[];
  pendingHigh: number;
  ungradedSheets: number;
  isFinal: boolean;
  busy: boolean;
  error: string | null;
  finaliseNotes: string[] | null;
  resultsHref: string;
  initialFilter?: ReviewFilter;
  onAccept: (id: string) => Promise<void> | void;
  onOverride: (id: string, awards: number[], note: string) => Promise<void> | void;
  onIllegible: (id: string) => void;
  onNeedsRescan: (id: string) => void;
  onUploadRescan: (submissionId: string, files: File[]) => void;
  onAcceptAllHigh: () => void;
  onFinalise: () => void;
}

/** Review queue: Low, then Medium, then High. Keyboard: A accept, E edit, J next, K previous. */
export function ReviewQueue(p: ReviewQueueProps) {
  const [filter, setFilter] = useState<ReviewFilter>(p.initialFilter ?? "needs_review");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ awards: number[]; note: string }>({ awards: [], note: "" });
  const [confirmHigh, setConfirmHigh] = useState(false);

  const visible = useMemo(() => {
    if (filter === "needs_review") return p.items.filter((i) => i.band !== "high" || i.needsRescan);
    if (filter === "pending") return p.items.filter((i) => i.status === "pending_review");
    return p.items;
  }, [p.items, filter]);

  const index = Math.max(0, visible.findIndex((i) => i.id === currentId));
  const current = visible[index] ?? null;
  const reviewed = p.items.filter((i) => i.status !== "pending_review").length;
  const allReviewed = p.items.length > 0 && reviewed === p.items.length && p.ungradedSheets === 0;

  useEffect(() => {
    if (!current && visible.length) setCurrentId(visible[0].id);
  }, [current, visible]);

  const go = (delta: number) => {
    if (!visible.length) return;
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + delta))];
    setCurrentId(next.id);
    setEditing(false);
  };
  const startEdit = () => {
    if (!current) return;
    setDraft({ awards: (current.teacherSteps ?? current.steps).map((s) => s.awarded), note: current.teacherNote ?? "" });
    setEditing(true);
  };
  const nextPending = (fromId: string) => {
    const start = visible.findIndex((i) => i.id === fromId);
    const after = [...visible.slice(start + 1), ...visible.slice(0, start)].find((i) => i.status === "pending_review" && i.id !== fromId);
    return after?.id ?? fromId;
  };
  // Updates are optimistic: move to the next answer immediately while the save happens.
  const accept = async () => {
    if (!current || current.needsRescan) return;
    const id = current.id;
    void p.onAccept(id);
    setCurrentId(nextPending(id));
  };
  const saveOverride = async () => {
    if (!current) return;
    const id = current.id;
    void p.onOverride(id, draft.awards, draft.note);
    setEditing(false);
    setCurrentId(nextPending(id));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || confirmHigh) return;
      const k = e.key.toLowerCase();
      if (k === "a" && !editing) {
        e.preventDefault();
        void accept();
      } else if (k === "e") {
        e.preventDefault();
        startEdit();
      } else if (k === "j") {
        e.preventDefault();
        go(1);
      } else if (k === "k") {
        e.preventDefault();
        go(-1);
      } else if (k === "escape" && editing) setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (p.items.length === 0) {
    return <EmptyState title="Nothing to review yet" description={p.ungradedSheets ? `${p.ungradedSheets} sheet(s) still need grading.` : "Grade the sheets first."} />;
  }

  return (
    <div className="space-y-4" data-demo-id="review-queue">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="mb-1 text-sm">
            <span className="font-semibold tabular-nums" data-demo-id="reviewed-count">
              {reviewed} of {p.items.length}
            </span>{" "}
            answers reviewed
          </div>
          <Progress value={(reviewed / p.items.length) * 100} label="Answers reviewed" />
        </div>
        {!p.isFinal && (
          <Button variant="secondary" disabled={p.busy || p.pendingHigh === 0} onClick={() => setConfirmHigh(true)} data-demo-id="accept-all-high">
            <CheckCheck /> Accept all High-confidence ({p.pendingHigh})
          </Button>
        )}
        {!p.isFinal ? (
          <Button disabled={p.busy || !allReviewed} onClick={p.onFinalise} data-demo-id="finalise-assessment" title={allReviewed ? "" : "Review every answer first"}>
            <Flag /> Mark as final
          </Button>
        ) : (
          <Button asChild variant="outline" data-demo-id="view-results">
            <Link href={p.resultsHref}>View results</Link>
          </Button>
        )}
      </div>

      {p.finaliseNotes && (
        <Alert tone="success" data-demo-id="finalise-notes">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Final. Mastery, the class dashboard and alerts are updated.
          </div>
          {p.finaliseNotes.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {p.finaliseNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {p.error && !current && <Alert tone="error">{p.error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ReviewFilter)}>
          <TabsList>
            <TabsTrigger value="needs_review" data-demo-id="filter-needs-review">
              Low &amp; Medium ({p.items.filter((i) => i.band !== "high").length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-demo-id="filter-pending">
              Not reviewed ({p.items.length - reviewed})
            </TabsTrigger>
            <TabsTrigger value="all" data-demo-id="filter-all">
              All ({p.items.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="hidden text-xs text-muted-foreground md:inline">
          <Kbd>A</Kbd> accept · <Kbd>E</Kbd> edit · <Kbd>J</Kbd> next · <Kbd>K</Kbd> previous
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing in this view" description="Switch tabs to see the other answers." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="hidden max-h-[72vh] overflow-y-auto rounded-xl border bg-card lg:block" aria-label="Answers">
            {visible.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => {
                    setCurrentId(i.id);
                    setEditing(false);
                  }}
                  data-demo-id={`queue-item-${i.id}`}
                  className={cn("flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/50", current?.id === i.id && "bg-accent")}
                >
                  {i.status !== "pending_review" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-high" aria-label="Reviewed" /> : <span className="h-4 w-4 shrink-0 rounded-full border" aria-label="Not reviewed" />}
                  <span className="min-w-0 flex-1 truncate">
                    {i.studentName} · Q{i.questionNumber}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatMarks(i.finalMarks)}</span>
                  <ConfidenceBadge band={i.band} showScore={false} className="px-1.5" />
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <AnswerReviewCard
              item={current}
              position={{ index, total: visible.length }}
              editing={editing}
              draft={draft}
              busy={p.busy || p.isFinal}
              error={p.error}
              onDraftChange={setDraft}
              onAccept={() => void accept()}
              onEdit={startEdit}
              onCancelEdit={() => setEditing(false)}
              onSaveOverride={() => void saveOverride()}
              onIllegible={() => p.onIllegible(current.id)}
              onNeedsRescan={() => p.onNeedsRescan(current.id)}
              onUploadRescan={(files) => p.onUploadRescan(current.submissionId, files)}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
            />
          )}
        </div>
      )}

      <Dialog open={confirmHigh} onOpenChange={setConfirmHigh}>
        <DialogContent data-demo-id="accept-high-dialog">
          <DialogHeader>
            <DialogTitle>Accept {p.pendingHigh} High-confidence answers?</DialogTitle>
            <DialogDescription>
              Both grading passes agreed on these and the handwriting was clear. They will be marked as accepted; you can still change any of them
              before the assessment is final.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmHigh(false)}>
              Cancel
            </Button>
            <Button
              data-demo-id="confirm-accept-high"
              onClick={() => {
                setConfirmHigh(false);
                p.onAcceptAllHigh();
              }}
            >
              Accept {p.pendingHigh}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
