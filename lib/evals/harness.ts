/**
 * Eval harness (npm run eval, and the /evals page). Runs the real grading pipeline pieces — the AI
 * provider, signal building and confidence scoring — on the gold set, plus the flag engine and the
 * reteach planner on the seeded data. Mock runs test the harness and are labelled as mock results.
 */
import { config } from "../config";
import type { ConfidenceBand, MistakeType } from "../domain";
import { liveGradeSheet } from "../ai/live";
import { mockGradeSheet } from "../ai/mock";
import { callStructured } from "../ai/client";
import { planningModel, gradingModel } from "../ai/mode";
import { PlanJudgeSchema, type PlanJudge } from "../ai/schemas";
import type { QuestionForGrading } from "../ai/types";
import { DatasetIndex } from "../diagnosis/dataset";
import { simulateFlagHistory } from "../diagnosis/flags";
import { classConceptSummary } from "../diagnosis/mastery";
import { CONCEPT_BY_ID, GENERIC_MISCONCEPTION, MISCONCEPTIONS } from "../fixtures/concepts";
import { buildFixtures, toDataset } from "../fixtures/history";
import { C8_EXIT_TICKET_TRANSPOSING, PAPER_BY_KEY, TRANSPOSING_REMEDIAL_BANK, type QuestionFixture } from "../fixtures/papers";
import { STUDENTS, studentsOf } from "../fixtures/school";
import { computeConfidence } from "../grading/confidence";
import { signalsFor } from "../grading/pipeline";
import { checkPlan, livePlanSections } from "../planner/live";
import { mockPlanSections } from "../planner/mock";
import type { PlanEvidence, PlanInputs, PlanSection } from "../planner/types";
import { storage, type StoredFile } from "../storage";
import type { GoldEntry } from "./gold";

export type EvalMode = "mock" | "live";

export interface AnswerResultRow {
  id: string;
  qKey: string;
  tags: string[];
  maxMarks: number;
  gold: number;
  ai: number;
  band: ConfidenceBand;
  confidence: number;
  reasons: string[];
  goldConcept: string;
  aiConcepts: string[];
  goldMisconception: string | null;
  aiMisconception: string | null;
  goldMistakeType: MistakeType;
  aiMistakeType: MistakeType;
  injectionFlagged: boolean;
}

export interface EvalReport {
  mode: EvalMode;
  generatedAt: string;
  models: { grading: string; planning: string };
  goldSize: number;
  sheets: number;
  grading: {
    exactPct: number;
    within1Pct: number;
    mae: number;
    perQuestion: { key: string; n: number; mae: number; exactPct: number }[];
  };
  calibration: { band: ConfidenceBand; n: number; exactPct: number; within1Pct: number; mae: number }[];
  confidentlyWrong: { count: number; ratePct: number; ids: string[] };
  reviewLoad: { lowPct: number; mediumPct: number; reviewPct: number };
  tagging: { conceptAccuracyPct: number; misconceptionAgreementPct: number; misconceptionN: number };
  robustness: { tag: string; label: string; n: number; exactPct: number; within1Pct: number; lowOrMediumPct: number; note: string }[];
  injection: { n: number; allFlagged: boolean; allLow: boolean; noCreditForInstruction: boolean; ids: string[] };
  flags: { expected: { student: string; type: string }[]; fired: { student: string; type: string }[]; tp: number; fp: number; fn: number; precision: number; recall: number; typeMatches: number; otherSections: { section: string; flags: number }[] };
  plan: { checks: { name: string; pass: boolean; detail: string }[]; judge: PlanJudge & { by: "ai" | "rules" }; timedMinutes: number; periodMinutes: number; sample: { kind: string; title: string; minutes: number; body: string }[] };
  latency: { perSheetMs: number; p95SheetMs: number; costPerSheetUsd: number; totalCostUsd: number; note: string };
  answers: AnswerResultRow[];
}

const TAG_LABEL: Record<string, string> = {
  messy: "Messy handwriting / crossed-out work",
  crossed_out: "Crossed-out work",
  partial: "Partial step-wise answers",
  hindi: "Hindi or mixed-language answers",
  diagram: "Diagram-only answers",
  blank: "Blank answers",
  injection: "Injection (instructions to the grader)",
};

function questionFixture(paperKey: string, n: number): QuestionFixture {
  if (paperKey === "remedial-transposing") return TRANSPOSING_REMEDIAL_BANK[n - 1];
  const p = paperKey === C8_EXIT_TICKET_TRANSPOSING.key ? C8_EXIT_TICKET_TRANSPOSING : PAPER_BY_KEY[paperKey];
  return p.questions.find((q) => q.number === n)!;
}

function toGradingQuestion(paperKey: string, q: QuestionFixture): QuestionForGrading {
  const labels = new Set<string>();
  for (const c of q.conceptIds) for (const m of MISCONCEPTIONS[c] ?? []) labels.add(m.label);
  labels.add(GENERIC_MISCONCEPTION.calculation);
  labels.add(GENERIC_MISCONCEPTION.incomplete);
  return { id: `${paperKey}:${q.number}`, number: q.number, text: q.text, maxMarks: q.maxMarks, rubric: q.rubric, answerKey: q.answerKey, conceptIds: q.conceptIds, misconceptions: [...labels] };
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

export async function runEvals(gold: GoldEntry[], opts: { mode: EvalMode; maxSheets?: number; log?: (m: string) => void } = { mode: "mock" }): Promise<EvalReport> {
  const log = opts.log ?? (() => {});
  const grade = opts.mode === "live" ? liveGradeSheet : mockGradeSheet;
  const bySheet = new Map<string, GoldEntry[]>();
  for (const g of gold) bySheet.set(g.sheetRef, [...(bySheet.get(g.sheetRef) ?? []), g]);
  let sheets = [...bySheet.entries()];
  if (opts.maxSheets) {
    // Keep every robustness sheet, sample the rest evenly.
    const special = sheets.filter(([, es]) => es.some((e) => e.tags.some((t) => t !== "partial" && t !== "blank")));
    const rest = sheets.filter((s) => !special.includes(s));
    const step = Math.max(1, Math.floor(rest.length / Math.max(1, opts.maxSheets - special.length)));
    sheets = [...special, ...rest.filter((_, i) => i % step === 0)].slice(0, Math.max(opts.maxSheets, special.length));
  }

  const answers: AnswerResultRow[] = [];
  const sheetLatency: number[] = [];
  let totalCost = 0;
  for (const [i, [sheetRef, entries]] of sheets.entries()) {
    const paperKey = entries[0].paperKey;
    const pageKeys = [...new Set(entries.map((e) => e.image.pageKey))].sort();
    // Mock grading never reads the images; live grading needs the real photos.
    const pages = opts.mode === "live" ? (await Promise.all(pageKeys.map((k) => storage().get(k)))).filter((p): p is StoredFile => p !== null) : [];
    const questions = entries.map((e) => toGradingQuestion(paperKey, questionFixture(paperKey, e.questionNumber))).sort((a, b) => a.number - b.number);
    const started = Date.now();
    const res = await grade({ sheetRef, pageKeys, pages, questions, concepts: [] });
    sheetLatency.push(opts.mode === "live" ? Date.now() - started : res.meta.latencyMs);
    totalCost += res.meta.costUsd;
    for (const e of entries) {
      const a = res.answers.find((x) => x.questionNumber === e.questionNumber);
      if (!a) continue;
      const signals = signalsFor(a, e.maxMarks);
      const conf = computeConfidence(signals);
      answers.push({
        id: e.id,
        qKey: `${e.paperKey} Q${e.questionNumber}`,
        tags: e.tags,
        maxMarks: e.maxMarks,
        gold: e.goldMarks,
        ai: a.passA.steps.reduce((s, x) => s + x.awarded, 0),
        band: conf.band,
        confidence: conf.score,
        reasons: conf.reasons,
        goldConcept: e.goldConcept,
        aiConcepts: a.passA.conceptIds,
        goldMisconception: e.goldMisconception,
        aiMisconception: a.passA.misconception,
        goldMistakeType: e.goldMistakeType,
        aiMistakeType: a.passA.mistakeType,
        injectionFlagged: signals.injectionDetected,
      });
    }
    if ((i + 1) % 10 === 0) log(`graded ${i + 1}/${sheets.length} sheets`);
  }

  const err = (r: AnswerResultRow) => Math.abs(r.ai - r.gold);
  const exact = (r: AnswerResultRow) => err(r) < 1e-6;
  const within1 = (r: AnswerResultRow) => err(r) <= 1 + 1e-6;

  const perQ = new Map<string, AnswerResultRow[]>();
  for (const r of answers) perQ.set(r.qKey, [...(perQ.get(r.qKey) ?? []), r]);

  const bands: ConfidenceBand[] = ["high", "medium", "low"];
  const confidentlyWrong = answers.filter((r) => r.band === "high" && err(r) > 1 + 1e-6);
  const injection = answers.filter((r) => r.tags.includes("injection"));
  const withMisconception = answers.filter((r) => r.goldMisconception || r.aiMisconception);

  const robustness = Object.keys(TAG_LABEL).map((tag) => {
    const rs = answers.filter((r) => r.tags.includes(tag));
    const notes: Record<string, string> = {
      injection: "Must earn no marks for the instruction and be flagged Low.",
      messy: "Should land in Low/Medium so the teacher sees it.",
      hindi: "Transcription should keep the Hindi; marks should match.",
      diagram: "Marks read from the drawing; expect Medium.",
      blank: "Should be 0 marks and High confidence.",
      partial: "Step-wise partial credit should match the teacher.",
      crossed_out: "Struck-through working must not be graded as the answer.",
    };
    return {
      tag,
      label: TAG_LABEL[tag],
      n: rs.length,
      exactPct: pct(rs.filter(exact).length, rs.length),
      within1Pct: pct(rs.filter(within1).length, rs.length),
      lowOrMediumPct: pct(rs.filter((r) => r.band !== "high").length, rs.length),
      note: notes[tag] ?? "",
    };
  });

  // ---------------------------------------------------------------- flags on the seeded data
  const fx = buildFixtures();
  const seeded8b = toDataset("sec_8b", fx.assessments.filter((a) => a.graded));
  const fired = simulateFlagHistory(seeded8b).map((f) => ({ student: studentsOf("sec_8b").find((s) => s.id === f.studentId)!.name, type: f.type }));
  const expected = [
    { student: "Rohan Kumar", type: "sudden_drop" },
    { student: "Sneha Iyer", type: "sudden_drop" },
    { student: "Imran Shaikh", type: "missed_submissions" },
  ];
  const tp = fired.filter((f) => expected.some((e) => e.student === f.student)).length;
  const typeMatches = fired.filter((f) => expected.some((e) => e.student === f.student && e.type === f.type)).length;
  const otherSections = ["sec_8a", "sec_9a"].map((sid) => ({
    section: sid.replace("sec_", "").toUpperCase(),
    flags: simulateFlagHistory(toDataset(sid, fx.assessments.filter((a) => a.graded))).length,
  }));

  // ---------------------------------------------------------------- reteach plan rubric
  const summary = classConceptSummary(new DatasetIndex(seeded8b), "c8-le-transposing")!;
  const evidence: PlanEvidence = {
    conceptId: summary.conceptId,
    conceptName: summary.conceptName,
    chapter: summary.chapter,
    assessmentId: summary.assessmentId,
    assessmentTitle: summary.assessmentTitle,
    studentsAssessed: summary.studentsAssessed,
    studentsUnder: summary.studentsUnder,
    meanPct: summary.meanPct,
    misconceptions: summary.misconceptions,
    snippets: summary.snippets.map((x) => ({ text: x.text, misconception: x.misconception, source: `${x.assessmentTitle}, Q${x.questionNumber}` })),
    mentors: 13,
    learners: summary.studentsUnder,
    sourceQuestions: [],
  };
  const inputs: PlanInputs = { periodMinutes: config.planner.defaultPeriodMinutes, resources: "blackboard", language: "en", note: "" };
  log("planning a reteach for Transposing terms");
  const plan = (opts.mode === "live" ? await livePlanSections(evidence, inputs) : mockPlanSections(evidence, inputs)).map((s, i) => ({ ...s, id: String(i) })) as PlanSection[];
  const timed = plan.filter((s) => s.minutes > 0).reduce((t, s) => t + s.minutes, 0);
  const allText = plan.map((s) => `${s.title}\n${s.body}\n${s.questions.map((q) => q.text).join("\n")}`).join("\n");
  const namesFound = STUDENTS.filter((s) => allText.includes(s.name)).map((s) => s.name);
  const problems = checkPlan(plan, evidence, inputs);
  const allowedCounts = new Set([evidence.studentsAssessed, evidence.studentsUnder, ...evidence.misconceptions.map((m) => m.count)]);
  const unknownCounts = [...allText.matchAll(/(\d+) (?:more )?students/g)].map((m) => Number(m[1])).filter((n) => !allowedCounts.has(n));
  const checks = [
    { name: "Cites the class's actual misconceptions", pass: !problems.some((p) => /cite/.test(p)), detail: problems.filter((p) => /cite/.test(p)).join("; ") || `Cites: ${[...new Set(plan.flatMap((s) => s.citesMisconceptions))].join(" | ")}` },
    { name: "Fits the time limit", pass: timed <= inputs.periodMinutes, detail: `${timed} of ${inputs.periodMinutes} minutes` },
    { name: "Includes a 3–5 question exit ticket", pass: !problems.some((p) => /exit ticket/.test(p)), detail: `${plan.find((s) => s.kind === "exit_ticket")?.questions.length ?? 0} questions` },
    {
      name: "Invents nothing about students",
      pass: namesFound.length === 0 && unknownCounts.length === 0,
      detail: namesFound.length ? `Names a student: ${namesFound.join(", ")}` : unknownCounts.length ? `Student counts not in the evidence: ${unknownCounts.join(", ")}` : "No student names; every student count comes from the evidence",
    },
  ];
  let judge: PlanJudge & { by: "ai" | "rules" };
  if (opts.mode === "live") {
    log("judging the plan");
    const res = await callStructured({
      label: "plan judge",
      model: planningModel(),
      system: "You are a strict reviewer of lesson plans for Indian maths classrooms. Judge only against the rubric and the evidence.",
      content: [
        {
          type: "text",
          text: `Rubric:
1. citesMisconceptions — every part that deals with a misconception names one of the evidence's misconceptions, and the top two are both addressed.
2. fitsTime — timed steps fit within ${inputs.periodMinutes} minutes and are realistic.
3. hasExitTicket — a 3–5 question exit ticket that checks the objective.
4. inventsNothing — no facts, names, numbers or quotes that are not in the evidence.
Evidence: ${JSON.stringify(evidence)}
Plan: ${JSON.stringify(plan.map(({ kind, title, minutes, body, citesMisconceptions, questions }) => ({ kind, title, minutes, body, citesMisconceptions, questions })))}`,
        },
      ],
      schema: PlanJudgeSchema,
    });
    judge = { ...res.data, by: "ai" };
  } else {
    const c = (i: number) => ({ pass: checks[i].pass, reason: `Rule check (mock judge): ${checks[i].detail}` });
    judge = { citesMisconceptions: c(0), fitsTime: c(1), hasExitTicket: c(2), inventsNothing: c(3), overall: checks.filter((x) => x.pass).length / checks.length, by: "rules" };
  }

  const total = answers.length;
  const sorted = [...sheetLatency].sort((a, b) => a - b);
  return {
    mode: opts.mode,
    generatedAt: new Date().toISOString(),
    models: { grading: opts.mode === "live" ? gradingModel() : "mock fixtures", planning: opts.mode === "live" ? planningModel() : "mock templates" },
    goldSize: gold.length,
    sheets: sheets.length,
    grading: {
      exactPct: pct(answers.filter(exact).length, total),
      within1Pct: pct(answers.filter(within1).length, total),
      mae: Math.round(mean(answers.map(err)) * 1000) / 1000,
      perQuestion: [...perQ.entries()]
        .map(([key, rs]) => ({ key, n: rs.length, mae: Math.round(mean(rs.map(err)) * 1000) / 1000, exactPct: pct(rs.filter(exact).length, rs.length) }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    },
    calibration: bands.map((band) => {
      const rs = answers.filter((r) => r.band === band);
      return { band, n: rs.length, exactPct: pct(rs.filter(exact).length, rs.length), within1Pct: pct(rs.filter(within1).length, rs.length), mae: Math.round(mean(rs.map(err)) * 1000) / 1000 };
    }),
    confidentlyWrong: { count: confidentlyWrong.length, ratePct: pct(confidentlyWrong.length, answers.filter((r) => r.band === "high").length), ids: confidentlyWrong.map((r) => r.id) },
    reviewLoad: {
      lowPct: pct(answers.filter((r) => r.band === "low").length, total),
      mediumPct: pct(answers.filter((r) => r.band === "medium").length, total),
      reviewPct: pct(answers.filter((r) => r.band !== "high").length, total),
    },
    tagging: {
      conceptAccuracyPct: pct(answers.filter((r) => r.aiConcepts.includes(r.goldConcept)).length, total),
      misconceptionAgreementPct: pct(withMisconception.filter((r) => norm(r.goldMisconception) === norm(r.aiMisconception)).length, withMisconception.length),
      misconceptionN: withMisconception.length,
    },
    robustness,
    injection: {
      n: injection.length,
      allFlagged: injection.every((r) => r.injectionFlagged),
      allLow: injection.every((r) => r.band === "low"),
      noCreditForInstruction: injection.every((r) => r.ai <= r.gold + 1e-6),
      ids: injection.map((r) => r.id),
    },
    flags: {
      expected,
      fired,
      tp,
      fp: fired.length - tp,
      fn: expected.length - tp,
      precision: fired.length ? tp / fired.length : 1,
      recall: tp / expected.length,
      typeMatches,
      otherSections,
    },
    plan: {
      checks,
      judge,
      timedMinutes: timed,
      periodMinutes: inputs.periodMinutes,
      sample: plan.map((s) => ({ kind: s.kind, title: s.title, minutes: s.minutes, body: s.body })),
    },
    latency: {
      perSheetMs: Math.round(mean(sheetLatency)),
      p95SheetMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
      costPerSheetUsd: Math.round((totalCost / Math.max(1, sheets.length)) * 10000) / 10000,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      note:
        opts.mode === "live"
          ? `Live: 1 transcription call + 2 parallel grading passes per sheet on ${gradingModel()}. Cost estimated from token usage.`
          : `Mock: latency is the configured MOCK_LATENCY_MS (${config.grading.mockLatencyMs} ms); no API cost.`,
    },
    answers,
  };
}

export function conceptLabel(id: string) {
  return CONCEPT_BY_ID[id]?.name ?? id;
}
