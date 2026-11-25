"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { AiSuggestedTag } from "@/components/shared/AiSuggested";
import type { RubricStep } from "@/lib/domain";

export interface QuestionDraftView {
  number: number;
  text: string;
  maxMarks: number;
  rubric: RubricStep[];
  answerKey: string;
  conceptIds: string[];
}

export interface QuestionConfirmTableProps {
  questions: QuestionDraftView[];
  concepts: { id: string; name: string; chapter: string }[];
  warnings: string[];
  confirmed: boolean;
  busy: boolean;
  error: string | null;
  onSave: (questions: QuestionDraftView[], confirm: boolean) => void;
  onReparse?: () => void;
  /** Called with the edited rows whenever the teacher changes something (for "save draft" on leaving). */
  onChange?: (questions: QuestionDraftView[]) => void;
}

/** Step 2: the AI's split of the paper, editable before grading starts. */
export function QuestionConfirmTable({ questions, concepts, warnings, confirmed, busy, error, onSave, onReparse, onChange }: QuestionConfirmTableProps) {
  const [rows, setRows] = useState(questions);
  useEffect(() => setRows(questions), [questions]);
  useEffect(() => {
    if (rows !== questions) onChange?.(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const update = (i: number, patch: Partial<QuestionDraftView>) => setRows((r) => r.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const total = rows.reduce((s, q) => s + q.rubric.reduce((a, r) => a + r.marks, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!confirmed && <AiSuggestedTag />}
        <span className="text-sm text-muted-foreground">
          {rows.length} questions · {total} marks. Check the text, step marks and concept tags, then confirm.
        </span>
      </div>
      {warnings.length > 0 && (
        <Alert tone="warn">
          <ul className="list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="space-y-3">
        {rows.map((q, i) => {
          const stepTotal = q.rubric.reduce((s, r) => s + r.marks, 0);
          return (
            <div key={i} className="rounded-lg border bg-card p-3" data-demo-id={`question-row-${q.number}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="w-16">
                  <label className="text-xs text-muted-foreground">Q no.</label>
                  <Input type="number" value={q.number} onChange={(e) => update(i, { number: Number(e.target.value) })} />
                </div>
                <div className="min-w-[220px] flex-1">
                  <label className="text-xs text-muted-foreground">Question</label>
                  <Textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} className="min-h-[52px]" data-demo-id={`question-text-${q.number}`} />
                </div>
                <div className="w-full sm:w-64">
                  <label className="text-xs text-muted-foreground">Concept</label>
                  <NativeSelect
                    value={q.conceptIds[0] ?? ""}
                    onChange={(e) => update(i, { conceptIds: e.target.value ? [e.target.value, ...q.conceptIds.slice(1).filter((c) => c !== e.target.value)] : [] })}
                    data-demo-id={`question-concept-${q.number}`}
                  >
                    <option value="">— none —</option>
                    {concepts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.chapter} › {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                  {q.conceptIds.length > 1 && <div className="mt-1 text-xs text-muted-foreground">+ {q.conceptIds.slice(1).map((id) => concepts.find((c) => c.id === id)?.name ?? id).join(", ")}</div>}
                </div>
                <button type="button" className="mt-5 rounded p-2 text-muted-foreground hover:bg-muted" aria-label={`Remove question ${q.number}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Step rubric · {stepTotal} marks</div>
                  <div className="space-y-1">
                    {q.rubric.map((r, k) => (
                      <div key={k} className="flex gap-2">
                        <Input value={r.step} onChange={(e) => update(i, { rubric: q.rubric.map((x, m) => (m === k ? { ...x, step: e.target.value } : x)) })} />
                        <Input type="number" step="0.5" className="w-20" value={r.marks} onChange={(e) => update(i, { rubric: q.rubric.map((x, m) => (m === k ? { ...x, marks: Number(e.target.value) } : x)) })} />
                        <button type="button" className="rounded px-2 text-muted-foreground hover:bg-muted" aria-label="Remove step" onClick={() => update(i, { rubric: q.rubric.filter((_, m) => m !== k) })}>
                          ×
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { rubric: [...q.rubric, { step: "", marks: 1 }] })}>
                      <Plus /> Step
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Answer key</div>
                  <Textarea value={q.answerKey} onChange={(e) => update(i, { answerKey: e.target.value })} className="min-h-[80px] font-mono text-xs" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((r) => [...r, { number: (r.at(-1)?.number ?? 0) + 1, text: "", maxMarks: 1, rubric: [{ step: "Correct answer", marks: 1 }], answerKey: "", conceptIds: [] }])}
      >
        <Plus /> Add question
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => onSave(rows.map((q) => ({ ...q, maxMarks: q.rubric.reduce((s, r) => s + r.marks, 0) })), true)} data-demo-id="confirm-questions">
          {confirmed ? "Save changes" : "Confirm questions"}
        </Button>
        {onReparse && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onReparse} data-demo-id="reparse-paper">
            Read the paper again
          </Button>
        )}
      </div>
    </div>
  );
}
