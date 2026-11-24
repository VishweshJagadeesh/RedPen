"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardCheck, Printer, Send, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { AiSuggestedTag } from "@/components/shared/AiSuggested";
import type { RemedialQuestion } from "@/lib/remedial/service";
import { cn } from "@/lib/utils";

export interface RemedialSetup {
  studentIds: string[];
  conceptIds: string[];
  count: number;
  mode: "group" | "individual";
}

export interface RemedialBuilderProps {
  phase: "setup" | "review";
  title?: string;
  roster: { id: string; name: string; rollNumber: number; hint?: string }[];
  concepts: { id: string; name: string; chapter: string }[];
  setup: RemedialSetup;
  fromFlag: boolean;
  questions: RemedialQuestion[];
  status?: "draft" | "assigned" | "graded";
  dirty: boolean;
  busy: string | null;
  error: string | null;
  printHref?: string;
  assessmentHref?: string | null;
  onSetupChange: (s: RemedialSetup) => void;
  onGenerate: () => void;
  onQuestionsChange: (q: RemedialQuestion[]) => void;
  onSave: () => void;
  onAssign: () => void;
}

const DIFF = ["", "Easier", "Medium", "Harder"];

/**
 * Build a remedial sheet for a student or a group: choose who and which concepts (prefilled from the
 * evidence), generate 5–10 questions easier → harder, each citing the mistake it targets, then review,
 * edit or remove before assigning.
 */
export function RemedialBuilder(p: RemedialBuilderProps) {
  const [filter, setFilter] = useState("");
  const selected = new Set(p.setup.studentIds);
  const locked = p.phase === "review";
  const visibleRoster = useMemo(() => p.roster.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase())), [p.roster, filter]);
  const conceptName = (id: string) => p.concepts.find((c) => c.id === id)?.name ?? id;
  const total = p.questions.reduce((s, q) => s + q.marks, 0);
  const editable = p.phase === "review" && p.status === "draft";

  const setQ = (i: number, patch: Partial<RemedialQuestion>) => p.onQuestionsChange(p.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const moveQ = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= p.questions.length) return;
    const next = [...p.questions];
    [next[i], next[j]] = [next[j], next[i]];
    p.onQuestionsChange(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]" data-demo-id="remedial-builder">
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <Label>Students ({selected.size})</Label>
            {p.fromFlag && <Badge variant="outline">From an alert</Badge>}
          </div>
          {!locked && <Input placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2 h-8" />}
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm" data-demo-id="remedial-students">
            {(locked ? p.roster.filter((s) => selected.has(s.id)) : visibleRoster).map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <Checkbox
                  id={`st-${s.id}`}
                  checked={selected.has(s.id)}
                  disabled={locked}
                  onCheckedChange={(v) =>
                    p.onSetupChange({ ...p.setup, studentIds: v ? [...p.setup.studentIds, s.id] : p.setup.studentIds.filter((x) => x !== s.id) })
                  }
                  data-demo-id={`remedial-student-${s.rollNumber}`}
                />
                <label htmlFor={`st-${s.id}`} className="flex-1 cursor-pointer">
                  {s.rollNumber}. {s.name}
                </label>
                {s.hint && <span className="text-xs tabular-nums text-muted-foreground">{s.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <Label>Target concepts</Label>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm" data-demo-id="remedial-concepts">
            {(locked ? p.concepts.filter((c) => p.setup.conceptIds.includes(c.id)) : p.concepts).map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Checkbox
                  id={`c-${c.id}`}
                  checked={p.setup.conceptIds.includes(c.id)}
                  disabled={locked}
                  onCheckedChange={(v) => p.onSetupChange({ ...p.setup, conceptIds: v ? [...p.setup.conceptIds, c.id] : p.setup.conceptIds.filter((x) => x !== c.id) })}
                  data-demo-id={`remedial-concept-${c.id}`}
                />
                <label htmlFor={`c-${c.id}`} className="cursor-pointer">
                  {c.name} <span className="text-xs text-muted-foreground">· {c.chapter}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {!locked && (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="count" className="flex-1">
                Questions per sheet
              </Label>
              <Input id="count" type="number" min={5} max={10} className="h-8 w-20" value={p.setup.count} onChange={(e) => p.onSetupChange({ ...p.setup, count: Number(e.target.value) })} data-demo-id="remedial-count" />
            </div>
            {selected.size > 1 && (
              <div className="space-y-1">
                <Label htmlFor="mode">Sheets</Label>
                <NativeSelect id="mode" value={p.setup.mode} onChange={(e) => p.onSetupChange({ ...p.setup, mode: e.target.value as RemedialSetup["mode"] })} data-demo-id="remedial-mode">
                  <option value="group">One sheet for the group</option>
                  <option value="individual">A personalised sheet per student</option>
                </NativeSelect>
              </div>
            )}
            {p.error && <Alert tone="error">{p.error}</Alert>}
            <Button className="w-full" onClick={p.onGenerate} disabled={!!p.busy || selected.size === 0 || p.setup.conceptIds.length === 0 || p.setup.count < 5 || p.setup.count > 10} data-demo-id="generate-remedial">
              <Sparkles /> {p.busy === "generate" ? "Writing questions from their mistakes…" : "Generate questions"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {p.phase === "setup" ? (
          <div className="grid min-h-60 place-items-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Questions appear here, ordered from easier to harder. Each one says which mistake it targets.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
              {p.status === "draft" ? <AiSuggestedTag /> : <Badge variant={p.status === "graded" ? "high" : "medium"}>{p.status === "graded" ? "Graded" : "Assigned · pending"}</Badge>}
              <span className="text-sm text-muted-foreground">
                {p.questions.length} questions · {total} marks{p.dirty ? " · unsaved changes" : ""}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                {editable && (
                  <>
                    <Button size="sm" variant="outline" disabled={!p.dirty || !!p.busy} onClick={p.onSave} data-demo-id="save-remedial">
                      Save
                    </Button>
                    <Button size="sm" disabled={p.dirty || !!p.busy} onClick={p.onAssign} data-demo-id="assign-remedial">
                      <Send /> Assign
                    </Button>
                  </>
                )}
                {p.printHref && (
                  <Button asChild size="sm" variant="outline" data-demo-id="print-remedial">
                    <Link href={p.printHref} target="_blank">
                      <Printer /> Printable sheets
                    </Link>
                  </Button>
                )}
                {p.assessmentHref && (
                  <Button asChild size="sm" data-demo-id="upload-remedial-submissions">
                    <Link href={p.assessmentHref}>
                      <ClipboardCheck /> {p.status === "graded" ? "Results" : "Upload & grade submissions"}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {p.error && <Alert tone="error">{p.error}</Alert>}
            <ol className="space-y-3">
              {p.questions.map((q, i) => (
                <li key={q.id} className="rounded-xl border bg-card p-4" data-demo-id={`remedial-question-${i + 1}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Q{i + 1}</span>
                    <Badge variant="secondary">{DIFF[q.difficulty] ?? "Medium"}</Badge>
                    <Badge variant="outline">{conceptName(q.conceptId)}</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">[{q.marks} marks]</span>
                    {editable && (
                      <div className="ml-auto flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => moveQ(i, -1)} disabled={i === 0}>
                          <ArrowUp />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => moveQ(i, 1)} disabled={i === p.questions.length - 1}>
                          <ArrowDown />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => p.onQuestionsChange(p.questions.filter((_, k) => k !== i))} data-demo-id={`remove-remedial-question-${i + 1}`}>
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editable ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_200px]">
                      <Textarea value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} className="min-h-[56px]" aria-label={`Question ${i + 1} text`} data-demo-id={`remedial-question-text-${i + 1}`} />
                      <Textarea value={q.answer} onChange={(e) => setQ(i, { answer: e.target.value })} className="min-h-[56px] font-mono text-xs" aria-label={`Question ${i + 1} answer`} />
                    </div>
                  ) : (
                    <p className="mt-2">{q.text}</p>
                  )}
                  <p className={cn("mt-2 rounded-md bg-accent/60 px-3 py-2 text-sm text-accent-foreground")} data-demo-id={`targets-mistake-${i + 1}`}>
                    <span className="font-medium">Targets: </span>
                    {q.targetsMistake}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
