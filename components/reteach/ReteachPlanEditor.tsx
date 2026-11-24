"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardCheck, Pencil, Play, Printer, RefreshCw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Progress } from "@/components/ui/misc";
import { AiSuggestedTag } from "@/components/shared/AiSuggested";
import { EvidenceSummary } from "./EvidenceSummary";
import { KIND_LABEL, TIMED_KINDS, type PlanEvidence, type PlanInputs, type PlanQuestion, type PlanSection } from "@/lib/planner/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ReteachPlanEditorProps {
  evidence: PlanEvidence;
  inputs: PlanInputs;
  sections: PlanSection[];
  status: "draft" | "ready" | "taught";
  taughtAt: string | null;
  exitTicket: { id: string; status: string; title: string } | null;
  students: { id: string; name: string; rollNumber: number }[];
  dirty: boolean;
  busy: string | null;
  error: string | null;
  teachHref: string;
  printHref: string;
  onChange: (sections: PlanSection[]) => void;
  onSave: () => void;
  onRegenerate: (sectionId: string) => void;
  onReshufflePairs: () => void;
  onStatus: (status: "draft" | "ready" | "taught", taughtAt?: string) => void;
  onCreateExitTicket: () => void;
}

const LANG_LABEL = { en: "English", hi: "Hindi", mixed: "Hindi + English" };
const RES_LABEL = { blackboard: "Blackboard only", projector: "Projector", worksheets: "Worksheets" };

/** The reteach plan: every section editable inline, reorderable, and individually regenerable. */
export function ReteachPlanEditor(p: ReteachPlanEditorProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [taughtDate, setTaughtDate] = useState(new Date().toISOString().slice(0, 10));
  const timed = p.sections.filter((s) => TIMED_KINDS.includes(s.kind)).reduce((t, s) => t + s.minutes, 0);
  const over = timed > p.inputs.periodMinutes;
  const labelIndex = (label: string) => p.evidence.misconceptions.findIndex((m) => m.label === label) + 1;

  const update = (id: string, patch: Partial<PlanSection>) => p.onChange(p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (id: string, delta: number) => {
    const i = p.sections.findIndex((s) => s.id === id);
    const j = i + delta;
    if (j < 0 || j >= p.sections.length) return;
    const next = [...p.sections];
    [next[i], next[j]] = [next[j], next[i]];
    p.onChange(next);
  };
  const updateQuestion = (s: PlanSection, qi: number, patch: Partial<PlanQuestion>) =>
    update(s.id, { questions: s.questions.map((q, k) => (k === qi ? { ...q, ...patch } : q)) });
  const setMentor = (s: PlanSection, gi: number, mentorId: string) => {
    if (!s.pairs) return;
    const student = p.students.find((x) => x.id === mentorId);
    if (!student) return;
    const groups = s.pairs.groups.map((g, k) => (k === gi ? { ...g, mentorId, mentorName: student.name } : g));
    update(s.id, { pairs: { ...s.pairs, groups } });
  };

  return (
    <div className="space-y-6" data-demo-id="reteach-plan-editor">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <EvidenceSummary evidence={p.evidence} />
        <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Status</span>
            <Badge variant={p.status === "taught" ? "high" : p.status === "ready" ? "default" : "secondary"} data-demo-id="plan-status">
              {p.status === "taught" ? `Taught ${formatDate(p.taughtAt)}` : p.status === "ready" ? "Ready" : "Draft"}
            </Badge>
          </div>
          <div className="text-muted-foreground">
            {p.inputs.periodMinutes} min · {RES_LABEL[p.inputs.resources]} · {LANG_LABEL[p.inputs.language]}
          </div>
          <div data-demo-id="plan-time-budget">
            <div className="mb-1 flex justify-between text-xs">
              <span>Timed steps</span>
              <span className={cn("tabular-nums", over && "font-semibold text-low")}>
                {timed} / {p.inputs.periodMinutes} min
              </span>
            </div>
            <Progress value={(timed / p.inputs.periodMinutes) * 100} label="Time used" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" data-demo-id="open-teaching-mode">
              <Link href={p.teachHref}>
                <Play /> Teaching mode
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" data-demo-id="print-plan">
              <Link href={p.printHref} target="_blank">
                <Printer /> Print
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {over && <Alert tone="warn">The timed steps add up to {timed} minutes — more than the {p.inputs.periodMinutes}-minute period. Trim a step before teaching.</Alert>}
      {p.error && <Alert tone="error">{p.error}</Alert>}

      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 backdrop-blur lg:top-2">
        <AiSuggestedTag accepted={p.status !== "draft"} />
        <span className="text-sm text-muted-foreground">{p.dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!p.dirty || !!p.busy} onClick={p.onSave} data-demo-id="save-plan">
            Save changes
          </Button>
          {p.status === "draft" && (
            <Button size="sm" disabled={!!p.busy || p.dirty} onClick={() => p.onStatus("ready")} data-demo-id="mark-plan-ready">
              <Check /> Mark ready
            </Button>
          )}
          {p.status !== "taught" ? (
            <span className="flex items-center gap-1">
              <Input type="date" className="h-8 w-36" value={taughtDate} onChange={(e) => setTaughtDate(e.target.value)} aria-label="Date taught" data-demo-id="taught-date" />
              <Button size="sm" disabled={!!p.busy || p.dirty} onClick={() => p.onStatus("taught", taughtDate)} data-demo-id="mark-plan-taught">
                Mark as taught
              </Button>
            </span>
          ) : p.exitTicket ? (
            <Button asChild size="sm" data-demo-id="open-exit-ticket">
              <Link href={p.exitTicket.status === "final" ? `/assessments/${p.exitTicket.id}/results` : `/assessments/${p.exitTicket.id}`}>
                <ClipboardCheck /> {p.exitTicket.status === "final" ? "Exit ticket results" : "Grade the exit ticket"}
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled={!!p.busy} onClick={p.onCreateExitTicket} data-demo-id="create-exit-ticket">
              <ClipboardCheck /> Create exit-ticket assessment
            </Button>
          )}
        </div>
      </div>

      <ol className="space-y-3">
        {p.sections.map((s, i) => {
          const isEditing = editing === s.id;
          const timedStep = TIMED_KINDS.includes(s.kind);
          return (
            <li key={s.id} className="rounded-xl border bg-card p-4" data-demo-id={`plan-section-${s.kind}`} data-section-id={s.id}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABEL[s.kind]}</div>
                  {isEditing ? (
                    <Input value={s.title} onChange={(e) => update(s.id, { title: e.target.value })} className="mt-1 font-semibold" aria-label="Section title" />
                  ) : (
                    <h3 className="font-semibold">{s.title}</h3>
                  )}
                </div>
                {timedStep &&
                  (isEditing ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Input type="number" min={1} className="h-8 w-16" value={s.minutes} onChange={(e) => update(s.id, { minutes: Number(e.target.value) })} aria-label="Minutes" />
                      min
                    </span>
                  ) : (
                    <Badge variant="secondary" className="tabular-nums">
                      {s.minutes} min
                    </Badge>
                  ))}
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => move(s.id, -1)} disabled={i === 0} data-demo-id={`move-up-${s.kind}`}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => move(s.id, 1)} disabled={i === p.sections.length - 1} data-demo-id={`move-down-${s.kind}`}>
                    <ArrowDown />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(isEditing ? null : s.id)} data-demo-id={`edit-section-${s.kind}`}>
                    {isEditing ? <Check /> : <Pencil />} {isEditing ? "Done" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!!p.busy || p.dirty || (s.kind === "exit_ticket" && !!p.exitTicket)} onClick={() => p.onRegenerate(s.id)} data-demo-id={`regenerate-${s.kind}`} title={p.dirty ? "Save changes first" : "Regenerate this section only"}>
                    <RefreshCw className={cn(p.busy === s.id && "animate-spin")} /> Regenerate
                  </Button>
                </div>
              </div>

              {s.citesMisconceptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" data-demo-id={`cites-${s.kind}`}>
                  {s.citesMisconceptions.map((c) => (
                    <Badge key={c} variant="ai">
                      Tackles #{labelIndex(c) || "?"}: {c}
                    </Badge>
                  ))}
                </div>
              )}

              {(s.body || isEditing) &&
                (isEditing ? (
                  <Textarea value={s.body} onChange={(e) => update(s.id, { body: e.target.value })} className="mt-3 min-h-[120px]" aria-label="Section text" data-demo-id={`section-body-${s.kind}`} />
                ) : (
                  <p className={cn("mt-3 whitespace-pre-wrap text-sm leading-relaxed", s.kind === "board_plan" && "rounded-lg bg-[#24352b] p-4 font-mono text-[#f1f5ef]")}>{s.body}</p>
                ))}

              {s.questions.length > 0 && (
                <ol className="mt-3 space-y-2 text-sm">
                  {s.questions.map((q, qi) => (
                    <li key={qi} className="rounded-lg border p-2">
                      {isEditing ? (
                        <div className="grid gap-2 sm:grid-cols-[1fr_160px_70px]">
                          <Input value={q.text} onChange={(e) => updateQuestion(s, qi, { text: e.target.value })} aria-label={`Question ${qi + 1}`} />
                          <Input value={q.answer} onChange={(e) => updateQuestion(s, qi, { answer: e.target.value })} aria-label={`Answer ${qi + 1}`} />
                          <Input type="number" min={1} value={q.marks} onChange={(e) => updateQuestion(s, qi, { marks: Number(e.target.value), rubric: [{ step: "Correct answer with working", marks: Number(e.target.value) }] })} aria-label={`Marks ${qi + 1}`} />
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <span className="font-medium">Q{qi + 1}.</span>
                          <span className="flex-1">{q.text}</span>
                          <span className="text-muted-foreground">Ans: {q.answer.split("\n").slice(-1)[0]}</span>
                          <span className="tabular-nums text-muted-foreground">[{q.marks}]</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {s.kind === "peer_pairs" && s.pairs && (
                <div className="mt-3 space-y-2" data-demo-id="peer-pairs">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={p.onReshufflePairs} disabled={!!p.busy || p.dirty} data-demo-id="reshuffle-pairs">
                      <Shuffle /> Reshuffle
                    </Button>
                    <span className="text-xs text-muted-foreground">{s.pairs.groups.length} mentors · {s.pairs.groups.reduce((t, g) => t + g.learners.length, 0)} learners paired</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {s.pairs.groups.map((g, gi) => (
                      <div key={gi} className="rounded-lg border p-2 text-sm">
                        {isEditing ? (
                          <NativeSelect value={g.mentorId} onChange={(e) => setMentor(s, gi, e.target.value)} className="h-8" aria-label="Mentor">
                            {p.students.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </NativeSelect>
                        ) : (
                          <div className="font-medium">
                            {g.mentorName} <span className="text-xs font-normal text-muted-foreground">mentor · {g.mentorPct}%</span>
                          </div>
                        )}
                        <div className="mt-1 text-muted-foreground">with {g.learners.map((l) => `${l.name} (${l.pct}%)`).join(", ")}</div>
                      </div>
                    ))}
                  </div>
                  {s.pairs.unpaired.length > 0 && (
                    <p className="text-xs text-muted-foreground">Sit with you during guided practice: {s.pairs.unpaired.map((u) => u.name).join(", ")}.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
