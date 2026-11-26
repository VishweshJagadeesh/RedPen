/**
 * Builds the walkthrough's data snapshot from the seed fixtures (server only, no database).
 *
 * The story runs the four flows in order on section 8B, so each flow sees the data the previous one
 * produced — exactly what the seeded app shows when a teacher clicks through them:
 *   1. WT4 is graded by the mock AI and reviewed (one override, then "accept all High").
 *   2. Transposing terms is reteached; the exit ticket is graded.
 *   3. Rohan's alert gets a remedial sheet, which comes back at 8/10.
 *   4. Rohan's PTM summary is built from the resulting facts.
 *
 * Everything goes through the app's own pure functions (diagnosis, planner, remedial, PTM, grading rows,
 * review items); only the thin database glue of each page is mirrored here, with a pointer to the original.
 */
import { statSync } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { DatasetIndex, round, type SectionDataset } from "@/lib/diagnosis/dataset";
import { evaluateSection, updateSummary, type FlagEvidence } from "@/lib/diagnosis/flags";
import { classConceptSummary, classWeakConcepts, conceptHeatmap, studentConceptMastery, suggestPeerPairs } from "@/lib/diagnosis/mastery";
import { toWeakConceptView, type WeakConceptView } from "@/lib/diagnosis/weak-concept-view";
import { CONCEPTS } from "@/lib/fixtures/concepts";
import { buildFixtures, questionId, submissionId, toDataset, WT4_8B_ID, type GenAssessment } from "@/lib/fixtures/history";
import { paper, type QuestionFixture } from "@/lib/fixtures/papers";
import { TEACHER, SECTIONS, STUDENTS, studentsOf } from "@/lib/fixtures/school";
import { SAMPLE_PAPERS, mockSheets, type MockAnswer, type MockSheet } from "@/lib/fixtures/sheets";
import { proposeMatch, MATCH_REVIEW_THRESHOLD } from "@/lib/grading/matching";
import { answerGradeRow, sheetBand } from "@/lib/grading/rows";
import { reviewItemFrom, sortReviewItems, type ReviewItem } from "@/lib/grading/review-items";
import { GENERIC_MISCONCEPTION, MISCONCEPTIONS } from "@/lib/fixtures/concepts";
import type { AnswerResult, PassResult, QuestionForGrading } from "@/lib/ai/types";
import type { StepAward } from "@/lib/domain";
import { evidenceFromDataset } from "@/lib/planner/evidence";
import { mockPlanSections } from "@/lib/planner/mock";
import { PLAN_STEPS, TIMED_KINDS, type PlanInputs, type PlanSection } from "@/lib/planner/types";
import { assembleRemedial, collectMistakesFromDataset, conceptsFromFlagEvidence, fixtureBank } from "@/lib/remedial/questions";
import { studentFactsFrom } from "@/lib/ptm/student-facts";
import { templateSummary } from "@/lib/ptm/summary";
import type { FlagHistoryEntry } from "@/lib/services/followups";
import type { FlagDetail } from "@/lib/queries/alerts";
import type { DemoData, GradedSheetStep } from "./types";
import { progressOf } from "./progress";

const SECTION_ID = "sec_8b";
const CONCEPT_ID = "c8-le-transposing";
/** Story dates after the seeded term (the seed's latest work is Homework 3 on 4 Nov 2026). */
const TAUGHT_DATE = "2026-11-06";
const REMEDIAL_ASSIGNED = "2026-11-07";
const REMEDIAL_GRADED = "2026-11-10";
const EXIT_ID = "asm_8b_exit_transposing";
const REMEDIAL_ID = "asm_8b_remedial_rohan";
const REMEDIAL_COUNT = 6;

const at = (date: string) => `${date}T09:30:00.000Z`;

function bytesOf(url: string): number {
  try {
    return statSync(path.join(process.cwd(), "public", url)).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------- grading (mirrors lib/ai/mock.ts + pipeline)

function questionsForGrading(asmId: string, qs: QuestionFixture[]): QuestionForGrading[] {
  return qs.map((q) => {
    const labels = new Set<string>();
    for (const c of q.conceptIds) for (const m of MISCONCEPTIONS[c] ?? []) labels.add(m.label);
    labels.add(GENERIC_MISCONCEPTION.calculation);
    labels.add(GENERIC_MISCONCEPTION.incomplete);
    return { id: questionId(asmId, q.number), number: q.number, text: q.text, maxMarks: q.maxMarks, rubric: q.rubric, answerKey: q.answerKey, conceptIds: q.conceptIds, misconceptions: [...labels] };
  });
}

const steps = (rubric: { step: string; marks: number }[], awards: number[]): StepAward[] => rubric.map((r, i) => ({ step: r.step, marks: r.marks, awarded: awards[i] ?? 0 }));

/** What mockGradeSheet returns for a bundled sample sheet. */
function mockAnswer(q: QuestionForGrading, m: MockAnswer): AnswerResult {
  const passA: PassResult = {
    steps: steps(q.rubric, m.passA.awards),
    mistakeType: m.passA.mistakeType,
    misconception: m.passA.misconception,
    conceptIds: q.conceptIds,
    reasoning: m.passA.reasoning,
    keyAmbiguity: m.keyAmbiguity,
    selfConfidence: m.selfConfidence,
  };
  return {
    questionNumber: q.number,
    pageIndex: m.pageIndex,
    crop: m.crop,
    transcription: m.transcription,
    legibility: m.legibility,
    uncertainSpans: m.uncertainSpans,
    crossedOut: m.crossedOut,
    mixedLanguage: m.mixedLanguage,
    containsInstructions: m.injectionDetected,
    passA,
    passB: { ...passA, steps: steps(q.rubric, m.passB.awards), mistakeType: m.passB.mistakeType, misconception: m.passB.misconception },
  };
}

/** Grades one sample sheet like the pipeline and returns its rows as review items. */
function gradeSheet(sheet: MockSheet, subId: string, qs: QuestionForGrading[], student: { name: string; rollNumber: number }): ReviewItem[] {
  return qs.map((q) => {
    const m = sheet.answers.find((a) => a.questionNumber === q.number)!;
    const row = answerGradeRow(subId, q, mockAnswer(q, m));
    const g = { ...row, teacherSteps: null, teacherMarks: null, teacherNote: null, needsRescan: false };
    return reviewItemFrom(g, { number: q.number, text: q.text, answerKey: q.answerKey, rubric: JSON.stringify(q.rubric) }, { id: subId, student, pageUrl: `/${sheet.pageKeys[m.pageIndex]}` });
  });
}

function orderOf(items: ReviewItem[], students: { id: string; name: string; rollNumber: number }[], subIdOf: (studentId: string) => string): GradedSheetStep[] {
  return students
    .map((st) => {
      const own = items.filter((i) => i.submissionId === subIdOf(st.id));
      if (!own.length) return null;
      return {
        submissionId: subIdOf(st.id),
        studentName: st.name,
        band: sheetBand(own.map((i) => i.confidence)),
        marks: own.reduce((t, i) => t + i.awardedMarks, 0),
        maxMarks: own.reduce((t, i) => t + i.maxMarks, 0),
        answerBands: own.map((i) => i.band),
      };
    })
    .filter((x): x is GradedSheetStep => !!x);
}

// ---------------------------------------------------------------- follow-ups (mirrors lib/services/followups.ts)

interface FlagState {
  id: string;
  studentId: string;
  type: string;
  status: FlagHistoryEntry["status"];
  createdAt: string;
  evidence: FlagEvidence;
  history: FlagHistoryEntry[];
}

/** onAssessmentFinalised for a regular test: recovery check on unresolved flags, then evidence updates. */
function finaliseRegular(ds: SectionDataset, asmId: string, flags: FlagState[], date: string) {
  const idx = new DatasetIndex(ds);
  const asm = ds.assessments.find((a) => a.id === asmId)!;
  for (const f of flags) {
    if (f.status === "resolved" || f.evidence.trigger.id === asm.id || f.evidence.trigger.date >= asm.date) continue;
    const score = idx.scorePct(asm.id, f.studentId);
    const baseline = f.evidence.scores?.previousAverage ?? f.evidence.lastScore?.pct;
    if (score === null || baseline === undefined) continue;
    if (score >= baseline - config.diagnosis.resolveWithin) {
      const next = f.status === "improving" ? "resolved" : "improving";
      f.status = next;
      f.history.push({ status: next, at: at(date), note: `${asm.shortTitle}: ${round(score)}%, within ${config.diagnosis.resolveWithin} points of the ${round(baseline)}% baseline.`, assessmentId: asm.id });
    }
  }
  for (const r of evaluateSection(ds)) {
    const existing = flags.find((f) => f.studentId === r.studentId && f.status !== "resolved");
    if (!existing) continue; // the fixtures guarantee no surprise alerts in 8B (tests/unit/fixtures.test.ts)
    if (existing.evidence.trigger.id !== asm.id && !existing.evidence.updates.some((u) => u.assessmentId === asm.id)) {
      existing.evidence = { ...existing.evidence, updates: [...existing.evidence.updates, { assessmentId: asm.id, title: asm.title, date: asm.date, summary: updateSummary(r) }] };
    }
  }
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ---------------------------------------------------------------- the snapshot

export function buildDemoData(): DemoData {
  const fx = buildFixtures();
  const section = SECTIONS.find((s) => s.id === SECTION_ID)!;
  const roster = studentsOf(SECTION_ID).map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber }));
  const nameOf = (id: string) => roster.find((s) => s.id === id)!;
  const sheets = mockSheets();

  // ---------------- Flow 1: Weekly Test 4
  const wt4 = fx.assessments.find((a) => a.id === WT4_8B_ID)!;
  const wt4Paper = paper(wt4.paperKey);
  const wt4Q = questionsForGrading(wt4.id, wt4Paper.questions);
  const wt4Sheets = [...sheets.values()].filter((s) => s.set === "8b-wt4").sort((a, b) => nameOf(a.studentId).rollNumber - nameOf(b.studentId).rollNumber);
  const grade8Concepts = CONCEPTS.filter((c) => c.gradeLevel === section.grade && !c.parentId).map((c) => ({ id: c.id, name: c.name, chapter: c.chapter }));

  // Matching (mirrors lib/queries/assessments.ts getAssessmentWizard).
  const matchSheets = wt4Sheets.map((sh) => {
    const p = proposeMatch(sh.detected, roster);
    return {
      id: submissionId(wt4.id, sh.studentId),
      pageCount: sh.pageKeys.length,
      firstPageUrl: `/${sh.pageKeys[0]}`,
      detectedName: sh.detected.name,
      detectedRoll: sh.detected.roll,
      studentId: p.studentId,
      confidence: p.confidence,
      reason: p.reason,
      needsReview: !p.studentId || p.confidence < MATCH_REVIEW_THRESHOLD,
      graded: false,
    };
  });

  const reviewItems: ReviewItem[] = [];
  for (const sh of wt4Sheets) reviewItems.push(...gradeSheet(sh, submissionId(wt4.id, sh.studentId), wt4Q, nameOf(sh.studentId)));
  sortReviewItems(reviewItems);
  const gradingOrder = orderOf(reviewItems, roster, (id) => submissionId(wt4.id, id));
  const messy = reviewItems[0];
  // The teacher's marks for the crossed-out answer are the gold marks in the fixtures.
  const messyGold = sheets.get(wt4Sheets.find((s) => submissionId(wt4.id, s.studentId) === messy.submissionId)!.sheetRef)!.answers.find((a) => a.questionNumber === messy.questionNumber)!.gold;

  // ---------------- Flow 2: after WT4 is final
  const wt4Final: GenAssessment = { ...wt4, graded: true };
  const others = fx.assessments.filter((a) => a.sectionId === SECTION_ID && a.id !== WT4_8B_ID && a.graded);
  const dsAfterWt4 = toDataset(SECTION_ID, [...others, wt4Final]);
  const idx1 = new DatasetIndex(dsAfterWt4);
  const summary = classConceptSummary(idx1, CONCEPT_ID)!;
  const weak = classWeakConcepts(idx1);
  // buildEvidence: the questions of the latest assessment that covered the concept.
  const sourceQuestions = paper(fx.assessments.find((a) => a.id === summary.assessmentId)?.paperKey ?? wt4.paperKey)
    .questions.filter((q) => q.conceptIds.includes(CONCEPT_ID))
    .map((q) => ({ text: q.text, answer: q.answerKey, marks: q.maxMarks, rubric: q.rubric }));
  const ev = evidenceFromDataset(dsAfterWt4, CONCEPT_ID, sourceQuestions)!;
  const inputs: PlanInputs = { periodMinutes: config.planner.defaultPeriodMinutes, resources: "blackboard", language: "mixed", note: "" };
  // createPlan: mock sections, ids, then peer pairs (seed 0).
  const pairs = suggestPeerPairs(ev.summary, dsAfterWt4.students, config.diagnosis, 0);
  const sections: PlanSection[] = mockPlanSections(ev.evidence, inputs).map((s, i) => ({ ...s, id: `sec${i + 1}`, ...(s.kind === "peer_pairs" ? { pairs: { ...pairs, seed: 0 } } : {}) }));
  const timed = sections.filter((s) => TIMED_KINDS.includes(s.kind)).reduce((t, s) => t + s.minutes, 0);
  const exitQs = sections.find((s) => s.kind === "exit_ticket")?.questions.length ?? 0;
  const named = ev.evidence.misconceptions.filter((m) => !/unattempted/i.test(m.label)).slice(0, 2);
  const generationDetail: Record<string, string | undefined> = {
    evidence: `${ev.evidence.studentsUnder} of ${ev.evidence.studentsAssessed} students under 50% in ${ev.evidence.assessmentTitle}`,
    misconceptions: named.length ? named.map((m, i) => `#${i + 1} ${m.label} (${m.count})`).join(" · ") : "No named misconception; the plan rebuilds the method",
    draft: `${sections.length} sections`,
    checks: `${timed} of ${inputs.periodMinutes} minutes · ${exitQs}-question exit ticket`,
    pairs: pairs.groups.length ? `${pairs.groups.length} mentor groups` : "No mentors available",
    save: undefined,
  };
  const teachingSteps = TIMED_KINDS.map((k) => sections.find((s) => s.kind === k)).filter((s): s is PlanSection => !!s);
  const boardPlan = sections.find((s) => s.kind === "board_plan")?.body ?? null;

  // The exit ticket (type exit_ticket) graded through the same flow.
  const exitPaper = paper("c8-et-transposing");
  const exitAsm: GenAssessment = { id: EXIT_ID, sectionId: SECTION_ID, paperKey: exitPaper.key, title: `Exit Ticket — ${ev.evidence.conceptName}`, shortTitle: "Exit ticket", type: "exit_ticket", date: TAUGHT_DATE, graded: true, submissions: fx.exitTicket8B };
  const exitQ = questionsForGrading(EXIT_ID, exitPaper.questions);
  const exitItems: ReviewItem[] = [];
  for (const sh of [...sheets.values()].filter((s) => s.set === "8b-exit-ticket")) exitItems.push(...gradeSheet(sh, submissionId(EXIT_ID, sh.studentId), exitQ, nameOf(sh.studentId)));
  const exitOrder = orderOf(exitItems, roster, (id) => submissionId(EXIT_ID, id));
  const dsAfterExit = toDataset(SECTION_ID, [...others, wt4Final, exitAsm]);
  const idx2 = new DatasetIndex(dsAfterExit);
  const after = classConceptSummary(idx2, CONCEPT_ID)!;
  const exitHistory = after.history.find((h) => h.assessmentId === EXIT_ID);
  const latestIsExit = after.assessmentId === EXIT_ID;
  // Mirrors lib/queries/section.ts sectionInsights (plan view on the card).
  const planView = (status: string, withExit: boolean): WeakConceptView["plan"] => ({
    id: "plan_demo",
    status,
    taughtAt: status === "taught" ? at(TAUGHT_DATE) : null,
    exitTicketAssessmentId: withExit ? EXIT_ID : null,
    exitTicketStatus: withExit ? "final" : null,
    beforePct: round(ev.evidence.meanPct),
    afterPct: withExit && exitHistory ? round(exitHistory.meanPct) : null,
    afterUnder: withExit && exitHistory && latestIsExit ? after.studentsUnder : null,
    afterAssessed: withExit && exitHistory && latestIsExit ? after.studentsAssessed : null,
  });
  const card: WeakConceptView = { ...toWeakConceptView(summary), plan: null };
  const cardAfter: WeakConceptView = { ...toWeakConceptView(after), plan: planView("taught", true) };
  const pctMap = (s: typeof summary) => Object.fromEntries(s.perStudent.map((p) => [p.studentId, round(p.pct)]));

  // ---------------- Flow 3: alerts (as seeded, then WT4's follow-ups)
  const flags: FlagState[] = fx.flags
    .filter((f) => f.sectionId === SECTION_ID)
    .map((f) => {
      const created = new Date(`${f.createdAt}T09:30:00Z`);
      created.setUTCDate(created.getUTCDate() + 3); // lib/seed: flags are created 3 days after the trigger
      return {
        id: `flag_${f.studentId.replace("stu_", "")}`,
        studentId: f.studentId,
        type: f.type,
        status: "open" as const,
        createdAt: created.toISOString(),
        evidence: f.evidence,
        history: [{ status: "open" as const, at: created.toISOString(), note: `Flagged automatically when ${f.evidence.trigger.title} was finalised.` }],
      };
    });
  finaliseRegular(dsAfterWt4, WT4_8B_ID, flags, wt4.date);
  const story = ["Rohan Kumar", "Sneha Iyer", "Imran Shaikh"];
  flags.sort((a, b) => story.indexOf(nameOf(a.studentId).name) - story.indexOf(nameOf(b.studentId).name));
  const detail = (f: FlagState, remedials: FlagDetail["remedials"] = []): FlagDetail => ({
    id: f.id,
    type: f.type,
    status: f.status,
    createdAt: f.createdAt,
    student: nameOf(f.studentId),
    section: { id: SECTION_ID, name: section.name },
    evidence: f.evidence,
    history: f.history.map((h) => ({ ...h })),
    remedials,
  });
  const rohanState = flags.find((f) => nameOf(f.studentId).name === "Rohan Kumar")!;
  const snehaState = flags.find((f) => nameOf(f.studentId).name === "Sneha Iyer")!;
  const imranState = flags.find((f) => nameOf(f.studentId).name === "Imran Shaikh")!;
  const rohanBefore = detail(rohanState);

  // Remedial builder (mirrors app/(app)/remedial/new + lib/queries/remedial.ts builderContext + createRemedial).
  const conceptIds = conceptsFromFlagEvidence(rohanState.evidence);
  const covered = new Set(dsAfterExit.assessments.flatMap((a) => a.questions.flatMap((q) => q.conceptIds)));
  const builderRoster = dsAfterExit.students.map((s) => {
    const m = studentConceptMastery(idx2, s.id, conceptIds[0]);
    return { id: s.id, name: s.name, rollNumber: s.rollNumber, hint: m ? `${round(m.pct)}%` : undefined };
  });
  const mistakes = collectMistakesFromDataset(dsAfterExit, [rohanState.studentId], conceptIds);
  let qn = 0;
  const remedialQs = assembleRemedial(conceptIds.map((c) => fixtureBank(c) ?? []), [rohanState.studentId], REMEDIAL_COUNT, mistakes, () => `rq${++qn}`);
  const conceptNames = conceptIds.map((c) => grade8Concepts.find((x) => x.id === c)!.name);
  const remTitle = `Remedial — ${conceptNames.join(", ")} — ${nameOf(rohanState.studentId).name}`;
  const kept = remedialQs.slice(0, REMEDIAL_COUNT - 1); // the walkthrough removes the last question

  // The sheet comes back and is graded (assignRemedial → sample sheet → mock AI).
  const remSheet = [...sheets.values()].find((s) => s.set === "8b-remedial-rohan")!;
  const remQ: QuestionForGrading[] = kept.map((q, i) => ({
    id: questionId(REMEDIAL_ID, i + 1),
    number: i + 1,
    text: q.text,
    maxMarks: q.rubric.reduce((s, x) => s + x.marks, 0) || q.marks,
    rubric: q.rubric,
    answerKey: q.answer,
    conceptIds: [q.conceptId],
    misconceptions: [...new Set([...(MISCONCEPTIONS[q.conceptId] ?? []).map((m) => m.label), GENERIC_MISCONCEPTION.calculation, GENERIC_MISCONCEPTION.incomplete])],
  }));
  const remItems = gradeSheet(remSheet, submissionId(REMEDIAL_ID, rohanState.studentId), remQ, nameOf(rohanState.studentId));
  sortReviewItems(remItems);
  // Finalised with every answer accepted: the dataset gains the remedial assessment.
  const dsFinal: SectionDataset = {
    ...dsAfterExit,
    assessments: [
      ...dsAfterExit.assessments,
      {
        id: REMEDIAL_ID,
        title: remTitle.replace(/^Remedial —/, "Remedial sheet —"),
        shortTitle: "Remedial",
        type: "remedial",
        date: REMEDIAL_GRADED,
        questions: remQ.map((q) => ({ id: q.id, number: q.number, maxMarks: q.maxMarks, conceptIds: q.conceptIds })),
        expectedStudentIds: [rohanState.studentId],
      },
    ],
    submissions: [
      ...dsAfterExit.submissions,
      {
        assessmentId: REMEDIAL_ID,
        studentId: rohanState.studentId,
        absent: false,
        answers: remItems.map((it) => ({ questionId: questionId(REMEDIAL_ID, it.questionNumber), marks: it.awardedMarks, maxMarks: it.maxMarks, mistakeType: it.mistakeType, misconception: it.misconception, transcription: it.transcription })),
      },
    ],
  };
  const remGot = remItems.reduce((t, i) => t + i.awardedMarks, 0);
  const remMax = remItems.reduce((t, i) => t + i.maxMarks, 0);
  const remPct = (remGot / remMax) * 100;
  // assignRemedial → action_taken; finalising the sheet → improving (lib/services/followups.ts).
  const rohanAfterState: FlagState = { ...rohanState, history: [...rohanState.history] };
  rohanAfterState.history.push({ status: "action_taken", at: at(REMEDIAL_ASSIGNED), note: `Remedial sheet assigned: ${kept.length} questions on ${conceptNames.join(", ")}.` });
  const before = rohanState.evidence.conceptBreakdown.find((c) => conceptIds.includes(c.conceptId));
  const scoreText = `${fmt(remGot)}/${fmt(remMax)} (${round(remPct)}%) on ${conceptNames.join(", ")}`;
  const improving = remPct >= config.diagnosis.improvingScore;
  rohanAfterState.status = improving ? "improving" : "action_taken";
  rohanAfterState.history.push({
    status: rohanAfterState.status,
    at: at(REMEDIAL_GRADED),
    note: improving ? `Remedial sheet: ${scoreText}${before ? `, up from ${before.afterPct}% in ${rohanState.evidence.trigger.shortTitle}` : ""}.` : `Remedial sheet: ${scoreText} — still below ${config.diagnosis.improvingScore}%.`,
    assessmentId: REMEDIAL_ID,
  });
  const rohanAfter = detail(rohanAfterState, [{ id: "rem_demo", title: remTitle, status: "graded", assessmentId: REMEDIAL_ID, assessmentStatus: "final" }]);

  // ---------------- Flow 4: PTM (mirrors app/(print)/students/[id]/ptm)
  const rohan = nameOf(rohanState.studentId);
  const sf = studentFactsFrom({
    student: { id: rohan.id, name: rohan.name, rollNumber: rohan.rollNumber, section: section.name, sectionId: SECTION_ID },
    ds: dsFinal,
    flags: [{ id: rohanAfterState.id, type: rohanAfterState.type, status: rohanAfterState.status, evidence: rohanAfterState.evidence, history: rohanAfterState.history }],
    pendingRemedials: [],
  });
  const ptmSummary = templateSummary(sf);
  const sources: Record<string, { label: string; href: string | null }> = {};
  for (const f of sf.facts) if (f.source) sources[f.id] = { label: f.source.label, href: null };

  const wt4Progress = progressOf(gradingOrder, gradingOrder.length, wt4Sheets.length, wt4Q.length);
  return {
    teacher: { name: TEACHER.name, subject: TEACHER.subject, sections: SECTIONS.map((s) => s.name), studentCount: STUDENTS.length },
    section: { id: SECTION_ID, name: section.name, students: roster },
    grade: {
      assessmentId: wt4.id,
      title: wt4.title,
      shortTitle: wt4.shortTitle,
      date: wt4.date,
      sheetCount: wt4Sheets.length,
      pageCount: wt4Sheets.reduce((t, s) => t + s.pageKeys.length, 0),
      questions: wt4Paper.questions.map((q) => ({ number: q.number, text: q.text, maxMarks: q.maxMarks, rubric: q.rubric, answerKey: q.answerKey, conceptIds: q.conceptIds })),
      concepts: grade8Concepts,
      paperImage: { url: `/${SAMPLE_PAPERS["c8-wt4"].paper[0]}`, bytes: bytesOf(SAMPLE_PAPERS["c8-wt4"].paper[0]) },
      keyImage: { url: `/${SAMPLE_PAPERS["c8-wt4"].key[0]}`, bytes: bytesOf(SAMPLE_PAPERS["c8-wt4"].key[0]) },
      sheets: matchSheets,
      roster,
      gradingOrder,
      totalAnswers: wt4Sheets.length * wt4Q.length,
      finalProgress: wt4Progress,
      reviewItems,
      messyId: messy.id,
      messyFinalAwards: messyGold.awards,
      nextId: reviewItems[1].id,
    },
    reteach: {
      conceptId: CONCEPT_ID,
      heatmap: conceptHeatmap(idx1),
      weakConceptIds: weak.map((w) => w.conceptId),
      card,
      before: pctMap(summary),
      after: pctMap(after),
      evidence: ev.evidence,
      inputs,
      defaultPeriod: config.planner.defaultPeriodMinutes,
      generation: PLAN_STEPS.map((s) => ({ id: s.id, label: s.label, detail: generationDetail[s.id] })),
      sections,
      teachingSteps,
      boardPlan,
      exitTicket: { title: exitAsm.title, sheets: exitOrder.length, answers: exitItems.length, progress: progressOf(exitOrder, exitOrder.length, exitOrder.length, exitQ.length) },
      cardAfter,
      taughtDate: TAUGHT_DATE,
    },
    remediate: {
      flags: flags.map((f) => ({ id: f.id, studentId: f.studentId, studentName: nameOf(f.studentId).name, section: section.name, type: f.type, status: f.status, createdAt: f.createdAt, summary: f.evidence.summary })),
      rohan: rohanBefore,
      sneha: detail(snehaState),
      imranId: imranState.studentId,
      builder: {
        roster: builderRoster,
        concepts: dsAfterExit.concepts.filter((c) => covered.has(c.id)),
        conceptIds,
        defaultCount: 5,
        count: REMEDIAL_COUNT,
        title: remTitle,
        questions: remedialQs,
      },
      sheet: {
        title: remTitle.replace(/^Remedial —/, "Remedial sheet —"),
        imageUrl: `/${remSheet.pageKeys[0]}`,
        reviewItems: remItems,
        marks: remGot,
        maxMarks: remMax,
        // lib/services/followups.ts onAssessmentFinalised
        assignedDate: REMEDIAL_ASSIGNED,
        finaliseNote: improving ? `${rohan.name}'s alert moved to Improving (${scoreText}).` : `${rohan.name}'s remedial sheet scored ${round(remPct)}%; the alert stays open.`,
      },
      rohanAfter,
    },
    ptm: {
      student: { name: sf.student.name, firstName: sf.student.firstName, section: sf.student.section, rollNumber: sf.student.rollNumber },
      trend: sf.trend,
      summary: ptmSummary,
      sources,
      parentName: `${rohan.name.split(" ")[0]}'s mother`,
    },
  };
}
