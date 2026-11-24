"use client";
import { Check, ChevronLeft, ChevronRight, FileWarning, Pencil, ScanLine, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Alert, Kbd } from "@/components/ui/misc";
import { AiSuggestedTag } from "@/components/shared/AiSuggested";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { HandwritingCrop } from "./HandwritingCrop";
import { MISTAKE_LABEL } from "@/lib/domain";
import { formatMarks } from "@/lib/format";
import type { ReviewItem } from "@/lib/queries/review";
import { cn } from "@/lib/utils";

export interface AnswerReviewCardProps {
  item: ReviewItem;
  position: { index: number; total: number };
  editing: boolean;
  draft: { awards: number[]; note: string };
  busy: boolean;
  error: string | null;
  onDraftChange: (draft: { awards: number[]; note: string }) => void;
  onAccept: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveOverride: () => void;
  onIllegible: () => void;
  onNeedsRescan: () => void;
  onUploadRescan: (files: File[]) => void;
  onPrev: () => void;
  onNext: () => void;
}

/** One answer: handwriting crop, transcription, key, step marks, AI reasoning, confidence and reasons. */
export function AnswerReviewCard(p: AnswerReviewCardProps) {
  const { item } = p;
  const steps = item.teacherSteps ?? item.steps;
  const reviewed = item.status !== "pending_review";
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" data-demo-id="answer-review-card" data-grade-id={item.id} data-band={item.band}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <div className="text-xs text-muted-foreground">
            {p.position.index + 1} of {p.position.total}
          </div>
          <div className="font-semibold" data-demo-id="review-student">
            {item.rollNumber ? `${item.rollNumber}. ` : ""}
            {item.studentName} · Q{item.questionNumber}
          </div>
        </div>
        <ConfidenceBadge band={item.band} score={item.confidence} />
        <AiSuggestedTag accepted={item.status === "accepted"} overridden={item.status === "overridden"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <HandwritingCrop url={item.pageUrl} crop={item.crop} />
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Transcription</div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-mono text-sm" data-demo-id="review-transcription">
              {item.transcription || "(blank)"}
            </pre>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Question</div>
            <p>{item.questionText}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Answer key</div>
            <pre className="whitespace-pre-wrap rounded-md border p-2 font-mono text-xs">{item.answerKey}</pre>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Step-wise marks</span>
              <span className="text-sm font-semibold text-foreground" data-demo-id="review-marks">
                {formatMarks(p.editing ? p.draft.awards.reduce((s, a) => s + (Number(a) || 0), 0) : item.finalMarks)} / {formatMarks(item.maxMarks)}
              </span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {steps.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">{s.step}</td>
                    <td className="w-28 py-1.5 text-right tabular-nums">
                      {p.editing ? (
                        <span className="inline-flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            max={s.marks}
                            className="h-8 w-16 text-right"
                            value={p.draft.awards[i] ?? 0}
                            aria-label={`Marks for step ${i + 1}`}
                            data-demo-id={`step-input-${i + 1}`}
                            onChange={(e) => p.onDraftChange({ ...p.draft, awards: p.draft.awards.map((a, j) => (j === i ? Number(e.target.value) : a)) })}
                          />
                          / {formatMarks(s.marks)}
                        </span>
                      ) : (
                        <span className={cn(s.awarded < s.marks && "text-low")}>
                          {formatMarks(s.awarded)} / {formatMarks(s.marks)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {item.status === "overridden" && (
              <div className="mt-1 text-xs text-muted-foreground">
                AI suggested {formatMarks(item.awardedMarks)}; you changed it to {formatMarks(item.teacherMarks)}.
              </div>
            )}
          </div>
          {p.editing && (
            <Textarea placeholder="Optional note (why you changed the marks)" value={p.draft.note} onChange={(e) => p.onDraftChange({ ...p.draft, note: e.target.value })} data-demo-id="override-note" />
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">AI reasoning</div>
          <p data-demo-id="review-reasoning">{item.aiReasoning}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">{MISTAKE_LABEL[item.mistakeType]}</Badge>
            {item.misconception && <Badge variant="outline">{item.misconception}</Badge>}
          </div>
        </div>
        <div data-demo-id="confidence-reasons">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Why this confidence</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {item.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {item.passes.length === 2 && (
            <div className="mt-1 text-xs text-muted-foreground">
              Pass A: {formatMarks(item.passes[0].marks)} · Pass B: {formatMarks(item.passes[1].marks)}
            </div>
          )}
        </div>
      </div>

      {item.needsRescan && (
        <Alert tone="warn" className="flex flex-wrap items-center gap-2">
          <ScanLine className="h-4 w-4" /> Marked for a re-scan. Upload a clearer photo of this sheet to grade it again.
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
            <Upload className="h-3.5 w-3.5" /> Upload re-scan
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => p.onUploadRescan(Array.from(e.target.files ?? []))} />
          </label>
        </Alert>
      )}
      {p.error && <Alert tone="error">{p.error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {p.editing ? (
          <>
            <Button onClick={p.onSaveOverride} disabled={p.busy} data-demo-id="save-override">
              Save marks
            </Button>
            <Button variant="ghost" onClick={p.onCancelEdit} disabled={p.busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={p.onAccept} disabled={p.busy || item.needsRescan} data-demo-id="accept-answer">
              <Check /> {reviewed ? "Accepted" : "Accept"} <Kbd>A</Kbd>
            </Button>
            <Button variant="outline" onClick={p.onEdit} disabled={p.busy} data-demo-id="edit-answer">
              <Pencil /> Change marks <Kbd>E</Kbd>
            </Button>
            <Button variant="ghost" onClick={p.onIllegible} disabled={p.busy} data-demo-id="mark-illegible">
              <FileWarning /> Illegible (0)
            </Button>
            <Button variant="ghost" onClick={p.onNeedsRescan} disabled={p.busy} data-demo-id="mark-rescan">
              <ScanLine /> Needs re-scan
            </Button>
          </>
        )}
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="icon" onClick={p.onPrev} aria-label="Previous answer (K)" data-demo-id="prev-answer">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" onClick={p.onNext} aria-label="Next answer (J)" data-demo-id="next-answer">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
