/**
 * "Needs attention" alerts. Every flag carries plain-language evidence with exact numbers:
 * scores before and after, which concepts and questions caused it, the mix of mistake types
 * and a suggested action. No unexplained flags.
 */
import { config } from "../config";
import { MISTAKE_LABEL, type FlagType, type MistakeType } from "../domain";
import {
  DatasetIndex,
  isClassWide,
  isRegular,
  median,
  pct,
  percentile,
  round,
  type DsAssessment,
  type SectionDataset,
} from "./dataset";

type DiagnosisConfig = typeof config.diagnosis;

export interface AssessmentRef {
  id: string;
  title: string;
  shortTitle: string;
  date: string;
}

export interface FlagRule {
  type: FlagType;
  rule: string;
  detail: string;
}

export interface FlagEvidence {
  primaryType: FlagType;
  summary: string;
  trigger: AssessmentRef;
  rulesFired: FlagRule[];
  scores?: {
    previous: (AssessmentRef & { pct: number })[];
    previousAverage: number;
    latest: AssessmentRef & { pct: number };
    dropPoints: number;
  };
  rank?: { previousTitle: string; previousPct: number; previousMedian: number; latestPct: number; latestP25: number };
  missed?: { window: (AssessmentRef & { submitted: boolean })[]; missedCount: number };
  lastScore?: AssessmentRef & { pct: number };
  chapterBreakdown: { chapter: string; got: number; max: number; lost: number; pct: number; beforePct: number | null }[];
  conceptBreakdown: { conceptId: string; name: string; beforePct: number | null; afterPct: number; got: number; max: number; marksLost: number }[];
  questionBreakdown: {
    assessmentId: string;
    assessmentTitle: string;
    questionId: string;
    number: number;
    concepts: string[];
    marks: number;
    maxMarks: number;
    mistakeType: MistakeType;
    misconception: string | null;
    transcription: string;
  }[];
  mistakeMix: { mistakeType: MistakeType; label: string; questions: number; marksLost: number }[];
  mistakePattern: string;
  regressions: { conceptId: string; name: string; beforePct: number; afterPct: number; drop: number }[];
  suggestedAction: string;
  /** Later evaluations that fired while the flag was still unresolved. */
  updates: { assessmentId: string; title: string; date: string; summary: string }[];
}

export interface StudentFlagResult {
  studentId: string;
  type: FlagType;
  evidence: FlagEvidence;
}

const PRIORITY: FlagType[] = ["missed_submissions", "sudden_drop", "concept_regression"];

const ref = (a: DsAssessment): AssessmentRef => ({ id: a.id, title: a.title, shortTitle: a.shortTitle, date: a.date });

function firstName(name: string) {
  return name.split(" ")[0];
}

function fmt(n: number) {
  return `${round(n)}%`;
}

function marksText(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Evaluate every student in the section as of its latest regular assessment. */
export function evaluateSection(ds: SectionDataset, cfg: DiagnosisConfig = config.diagnosis): StudentFlagResult[] {
  const idx = new DatasetIndex(ds);
  const regular = ds.assessments.filter(isRegular);
  if (regular.length === 0) return [];
  const latest = regular[regular.length - 1];
  const previousAssessment = regular.length > 1 ? regular[regular.length - 2] : undefined;

  const latestScores = ds.students.map((s) => idx.scorePct(latest.id, s.id)).filter((v): v is number => v !== null);
  const p25 = percentile(latestScores, 25);
  const prevScores = previousAssessment
    ? ds.students.map((s) => idx.scorePct(previousAssessment.id, s.id)).filter((v): v is number => v !== null)
    : [];
  const prevMedian = median(prevScores);

  const results: StudentFlagResult[] = [];
  for (const student of ds.students) {
    const rules: FlagRule[] = [];
    const evidence: Partial<FlagEvidence> = { regressions: [] };

    // missed_submissions
    // Evaluated once the student has a full window of tests to judge against.
    const window = regular.filter((a) => idx.expected(a).includes(student.id)).slice(-cfg.missedWindow);
    const windowRows = window.map((a) => ({ ...ref(a), submitted: idx.scorePct(a.id, student.id) !== null }));
    const missedCount = windowRows.filter((w) => !w.submitted).length;
    if (windowRows.length >= cfg.missedWindow && missedCount >= cfg.missedCount) {
      const missedTitles = windowRows.filter((w) => !w.submitted).map((w) => w.shortTitle);
      rules.push({
        type: "missed_submissions",
        rule: `${cfg.missedCount}+ missing submissions in the last ${cfg.missedWindow} tests`,
        detail: `Missed ${missedCount} of the last ${windowRows.length} tests (${missedTitles.join(", ")}).`,
      });
      evidence.missed = { window: windowRows, missedCount };
    }

    const latestPct = idx.scorePct(latest.id, student.id);
    const submittedHistory = regular
      .map((a) => ({ a, pct: idx.scorePct(a.id, student.id) }))
      .filter((x): x is { a: DsAssessment; pct: number } => x.pct !== null);
    const lastSubmitted = submittedHistory[submittedHistory.length - 1];
    if (lastSubmitted) evidence.lastScore = { ...ref(lastSubmitted.a), pct: round(lastSubmitted.pct, 1) };

    if (latestPct !== null) {
      // sudden_drop (a): vs own average of previous N
      const previous = submittedHistory.filter((x) => x.a.id !== latest.id).slice(-cfg.suddenDropWindow);
      if (previous.length >= 1) {
        const avg = previous.reduce((s, x) => s + x.pct, 0) / previous.length;
        const drop = avg - latestPct;
        evidence.scores = {
          previous: previous.map((x) => ({ ...ref(x.a), pct: round(x.pct, 1) })),
          previousAverage: round(avg, 1),
          latest: { ...ref(latest), pct: round(latestPct, 1) },
          dropPoints: round(drop, 1),
        };
        if (drop >= cfg.suddenDropPoints) {
          rules.push({
            type: "sudden_drop",
            rule: `Latest score at least ${cfg.suddenDropPoints} points below own average of previous ${cfg.suddenDropWindow}`,
            detail: `${latest.shortTitle}: ${fmt(latestPct)}, against an average of ${fmt(avg)} over ${previous.map((x) => x.a.shortTitle).join(", ")} (−${round(drop)} points).`,
          });
        }
      }
      // sudden_drop (b): from above the median to below the 25th percentile
      if (previousAssessment) {
        const pp = idx.scorePct(previousAssessment.id, student.id);
        if (pp !== null && pp > prevMedian && latestPct < p25) {
          evidence.rank = {
            previousTitle: previousAssessment.shortTitle,
            previousPct: round(pp, 1),
            previousMedian: round(prevMedian, 1),
            latestPct: round(latestPct, 1),
            latestP25: round(p25, 1),
          };
          rules.push({
            type: "sudden_drop",
            rule: "Was above the section median, now below the 25th percentile",
            detail: `${previousAssessment.shortTitle}: ${fmt(pp)} (section median ${fmt(prevMedian)}); ${latest.shortTitle}: ${fmt(latestPct)} (25th percentile ${fmt(p25)}).`,
          });
        }
      }
      // concept_regression
      const conceptIds = [...new Set(latest.questions.flatMap((q) => q.conceptIds))];
      for (const c of conceptIds) {
        if (idx.conceptMaxInAssessment(latest.id, c) < cfg.minConceptMarks) continue;
        const after = idx.conceptMarks(latest.id, student.id, c);
        const before = priorConceptWindow(idx, student.id, c, latest, cfg.minConceptMarks);
        if (!after || !before) continue;
        const afterPct = pct(after.got, after.max);
        const drop = before.pct - afterPct;
        if (drop >= cfg.regressionPoints) {
          const name = ds.concepts.find((x) => x.id === c)?.name ?? c;
          evidence.regressions!.push({ conceptId: c, name, beforePct: round(before.pct), afterPct: round(afterPct), drop: round(drop) });
          rules.push({
            type: "concept_regression",
            rule: `Concept mastery fell by ${cfg.regressionPoints}+ points`,
            detail: `${name}: ${fmt(before.pct)} before, ${fmt(afterPct)} in ${latest.shortTitle} (−${round(drop)} points).`,
          });
        }
      }
    }

    if (rules.length === 0) continue;
    const primary = PRIORITY.find((t) => rules.some((r) => r.type === t))!;
    const full = buildEvidence(idx, student, latest, primary, rules, evidence, cfg);
    results.push({ studentId: student.id, type: primary, evidence: full });
  }
  return results;
}

function priorConceptWindow(idx: DatasetIndex, studentId: string, conceptId: string, latest: DsAssessment, minMarks: number) {
  let got = 0;
  let max = 0;
  const earlier = idx.ds.assessments.filter((a) => isClassWide(a) && a.date < latest.date && a.id !== latest.id).reverse();
  for (const a of earlier) {
    const m = idx.conceptMarks(a.id, studentId, conceptId);
    if (!m) continue;
    got += m.got;
    max += m.max;
    if (max >= minMarks) break;
  }
  if (max < minMarks) return null;
  return { got, max, pct: pct(got, max) };
}

function buildEvidence(
  idx: DatasetIndex,
  student: { id: string; name: string },
  latest: DsAssessment,
  primary: FlagType,
  rules: FlagRule[],
  partial: Partial<FlagEvidence>,
  cfg: DiagnosisConfig,
): FlagEvidence {
  const ds = idx.ds;
  const conceptName = (id: string) => ds.concepts.find((c) => c.id === id)?.name ?? id;
  const chapterOf = (id: string) => ds.concepts.find((c) => c.id === id)?.chapter ?? "Other";
  const sub = idx.submission(latest.id, student.id);
  const submittedLatest = !!sub && !sub.absent;

  // Question and concept breakdown for the latest test (if submitted).
  const questionBreakdown: FlagEvidence["questionBreakdown"] = [];
  const chapterMap = new Map<string, { got: number; max: number }>();
  if (submittedLatest) {
    for (const q of latest.questions) {
      const ans = sub!.answers.find((a) => a.questionId === q.id);
      const marks = ans?.marks ?? 0;
      const ch = chapterOf(q.conceptIds[0] ?? "");
      const agg = chapterMap.get(ch) ?? { got: 0, max: 0 };
      agg.got += marks;
      agg.max += q.maxMarks;
      chapterMap.set(ch, agg);
      if (marks < q.maxMarks) {
        questionBreakdown.push({
          assessmentId: latest.id,
          assessmentTitle: latest.title,
          questionId: q.id,
          number: q.number,
          concepts: q.conceptIds.map(conceptName),
          marks,
          maxMarks: q.maxMarks,
          mistakeType: ans?.mistakeType ?? "unattempted",
          misconception: ans?.misconception ?? null,
          transcription: ans?.transcription ?? "",
        });
      }
    }
  }
  questionBreakdown.sort((a, b) => b.maxMarks - b.marks - (a.maxMarks - a.marks) || a.number - b.number);

  const conceptIds = [...new Set(latest.questions.flatMap((q) => q.conceptIds))];
  const conceptBreakdown: FlagEvidence["conceptBreakdown"] = [];
  if (submittedLatest) {
    for (const c of conceptIds) {
      const after = idx.conceptMarks(latest.id, student.id, c);
      if (!after) continue;
      const before = priorConceptWindow(idx, student.id, c, latest, 1);
      conceptBreakdown.push({
        conceptId: c,
        name: conceptName(c),
        beforePct: before ? round(before.pct) : null,
        afterPct: round(pct(after.got, after.max)),
        got: after.got,
        max: after.max,
        marksLost: after.max - after.got,
      });
    }
    conceptBreakdown.sort((a, b) => b.marksLost - a.marksLost);
  }

  const chapterBreakdown: FlagEvidence["chapterBreakdown"] = [...chapterMap.entries()]
    .map(([chapter, v]) => {
      const chapterConcepts = conceptIds.filter((c) => chapterOf(c) === chapter);
      let bGot = 0;
      let bMax = 0;
      for (const c of chapterConcepts) {
        const b = priorConceptWindow(idx, student.id, c, latest, 1);
        if (b) {
          bGot += b.got;
          bMax += b.max;
        }
      }
      return { chapter, got: v.got, max: v.max, lost: v.max - v.got, pct: round(pct(v.got, v.max)), beforePct: bMax ? round(pct(bGot, bMax)) : null };
    })
    .sort((a, b) => b.lost - a.lost);

  // Mistake mix on the latest test.
  const mixMap = new Map<MistakeType, { questions: number; marksLost: number }>();
  for (const q of questionBreakdown) {
    const m = mixMap.get(q.mistakeType) ?? { questions: 0, marksLost: 0 };
    m.questions += 1;
    m.marksLost += q.maxMarks - q.marks;
    mixMap.set(q.mistakeType, m);
  }
  const mistakeMix = [...mixMap.entries()]
    .map(([mistakeType, v]) => ({ mistakeType, label: MISTAKE_LABEL[mistakeType], ...v }))
    .sort((a, b) => b.marksLost - a.marksLost);
  const mistakePattern = describeMistakes(mistakeMix);

  const first = firstName(student.name);
  const summary = buildSummary(primary, partial, chapterBreakdown, mistakeMix, latest, first);
  const suggestedAction = suggestAction(primary, mistakeMix, conceptBreakdown, questionBreakdown, partial, first);

  void cfg;
  return {
    primaryType: primary,
    summary,
    trigger: ref(latest),
    rulesFired: rules,
    scores: partial.scores,
    rank: partial.rank,
    missed: partial.missed,
    lastScore: partial.lastScore,
    chapterBreakdown,
    conceptBreakdown,
    questionBreakdown,
    mistakeMix,
    mistakePattern,
    regressions: partial.regressions ?? [],
    suggestedAction,
    updates: [],
  };
}

export function describeMistakes(mix: FlagEvidence["mistakeMix"]): string {
  const total = mix.reduce((s, m) => s + m.marksLost, 0);
  if (total === 0 || mix.length === 0) return "No marks were lost on the submitted work.";
  const top = mix[0];
  const share = top.marksLost / total;
  const n = top.questions;
  const qs = `${n} question${n === 1 ? "" : "s"}`;
  const lost = `${marksText(top.marksLost)} of the ${marksText(total)} marks lost`;
  const phrase: Record<MistakeType, string> = {
    unattempted: `${qs} left unattempted (${lost})`,
    calculation: `calculation slips on ${qs} where the method was right (${lost})`,
    conceptual: `conceptual errors on ${qs} (${lost})`,
    procedural: `procedural errors on ${qs} (${lost})`,
    incomplete: `${qs} left incomplete (${lost})`,
    illegible: `${qs} that could not be read (${lost})`,
    none: `minor deductions (${lost})`,
  };
  if (share >= 0.5) return `Mostly ${phrase[top.mistakeType]}.`;
  const parts = mix.slice(0, 3).map((m) => `${m.label.toLowerCase()} ${round((m.marksLost / total) * 100)}%`);
  return `Mixed: ${parts.join(", ")} of marks lost. Largest share: ${phrase[top.mistakeType]}.`;
}

function buildSummary(
  primary: FlagType,
  e: Partial<FlagEvidence>,
  chapters: FlagEvidence["chapterBreakdown"],
  mix: FlagEvidence["mistakeMix"],
  latest: DsAssessment,
  first: string,
): string {
  const parts: string[] = [];
  if (primary === "missed_submissions" && e.missed) {
    const missed = e.missed.window.filter((w) => !w.submitted).map((w) => w.shortTitle);
    parts.push(`Missed ${e.missed.missedCount} of the last ${e.missed.window.length} tests (${missed.join(", ")}).`);
    if (e.scores && e.scores.dropPoints > 0) {
      parts.push(`Score fell from ${fmt(e.scores.previousAverage)} to ${fmt(e.scores.latest.pct)} in ${latest.shortTitle}.`);
    } else if (e.lastScore) {
      parts.push(`Last score: ${fmt(e.lastScore.pct)} in ${e.lastScore.shortTitle}.`);
    }
    return parts.join(" ");
  }
  if (primary === "concept_regression" && e.regressions?.length) {
    const r = e.regressions[0];
    parts.push(`${r.name} fell from ${r.beforePct}% to ${r.afterPct}% in ${latest.shortTitle} (−${r.drop} points).`);
    if (mix[0]) parts.push(describeMistakes(mix));
    return parts.join(" ");
  }
  if (e.scores && e.scores.dropPoints >= config.diagnosis.suddenDropPoints) {
    parts.push(`Average of ${fmt(e.scores.previousAverage)} fell to ${fmt(e.scores.latest.pct)} in ${latest.shortTitle} (−${round(e.scores.dropPoints)} points).`);
  } else if (e.rank) {
    parts.push(
      `Was above the class median in ${e.rank.previousTitle} (${fmt(e.rank.previousPct)}; median ${fmt(e.rank.previousMedian)}), now below the 25th percentile in ${latest.shortTitle} (${fmt(e.rank.latestPct)}; 25th percentile ${fmt(e.rank.latestP25)}).`,
    );
  }
  const totalLost = chapters.reduce((s, c) => s + c.lost, 0);
  const topChapter = chapters[0];
  const mixTotal = mix.reduce((s, m) => s + m.marksLost, 0);
  const topMistake = mix[0];
  if (topMistake && mixTotal > 0 && topMistake.marksLost / mixTotal >= 0.6 && topMistake.mistakeType !== "none") {
    parts.push(describeMistakes(mix));
  } else if (topChapter && totalLost > 0 && chapters.length > 1 && topChapter.lost / totalLost >= 0.4) {
    const blank = mix.find((m) => m.mistakeType === "unattempted");
    parts.push(
      `Losses concentrated in ${topChapter.chapter}: ${marksText(topChapter.got)}/${marksText(topChapter.max)}${
        blank ? `, with ${blank.questions} question${blank.questions === 1 ? "" : "s"} unattempted` : ""
      }.`,
    );
  } else if (mix[0]) {
    const top = mix[0];
    const total = mix.reduce((s, m) => s + m.marksLost, 0);
    if (top.marksLost / total >= 0.5) parts.push(`Mostly ${top.label.toLowerCase()}${top.mistakeType === "calculation" ? "s" : ""}.`);
  }
  if (parts.length === 0) parts.push(`${first} needs a closer look after ${latest.shortTitle}.`);
  return parts.join(" ");
}

function suggestAction(
  primary: FlagType,
  mix: FlagEvidence["mistakeMix"],
  concepts: FlagEvidence["conceptBreakdown"],
  questions: FlagEvidence["questionBreakdown"],
  e: Partial<FlagEvidence>,
  first: string,
): string {
  const weakest = concepts.filter((c) => c.marksLost > 0).slice(0, 2).map((c) => c.name);
  const conceptList = weakest.length ? weakest.join(" and ") : "the concepts in this test";
  if (primary === "missed_submissions") {
    const missed = e.missed?.window.filter((w) => !w.submitted).map((w) => w.shortTitle).join(" and ") ?? "the missed tests";
    return `Find out why ${first} missed ${missed} (absence, illness, something at home). Arrange a make-up attempt and share notes for those chapters before the next test${
      weakest.length ? `; then a short remedial sheet on ${conceptList}` : ""
    }.`;
  }
  const top = mix[0]?.mistakeType;
  if (top === "unattempted") {
    return `Talk to ${first} privately: blank answers usually point to a gap from missed lessons, low confidence or running out of time. Start with a short remedial sheet on ${conceptList}, easiest questions first.`;
  }
  if (top === "calculation") {
    return `No reteach needed: the method is right and the marks went on arithmetic. Ask ${first} to re-check each line before moving on, and give a short mixed-calculation practice set.`;
  }
  if (primary === "concept_regression" && e.regressions?.length) {
    return `Revisit ${e.regressions[0].name} with ${first}: the earlier score shows it was understood once. A 5-question remedial sheet will show whether this is a one-off.`;
  }
  const misconception = questions.find((q) => q.misconception)?.misconception;
  return `Reteach ${conceptList} in a small group${misconception ? `, focusing on "${misconception.toLowerCase()}"` : ""}, then assign a remedial sheet.`;
}

export interface SimulatedFlag {
  studentId: string;
  type: FlagType;
  evidence: FlagEvidence;
  createdAt: string;
  triggerAssessmentId: string;
}

/**
 * Replays the section's history assessment by assessment, as the app does on every finalisation:
 * a student gets at most one unresolved flag; later signals become updates on it.
 */
export function simulateFlagHistory(ds: SectionDataset, cfg: DiagnosisConfig = config.diagnosis): SimulatedFlag[] {
  const regular = ds.assessments.filter(isRegular);
  const open = new Map<string, SimulatedFlag>();
  for (const a of regular) {
    const prefix: SectionDataset = { ...ds, assessments: ds.assessments.filter((x) => x.date <= a.date) };
    for (const r of evaluateSection(prefix, cfg)) {
      const existing = open.get(r.studentId);
      if (existing) {
        if (existing.triggerAssessmentId !== a.id) {
          existing.evidence.updates.push({ assessmentId: a.id, title: a.title, date: a.date, summary: updateSummary(r) });
        }
      } else {
        open.set(r.studentId, { studentId: r.studentId, type: r.type, evidence: r.evidence, createdAt: a.date, triggerAssessmentId: a.id });
      }
    }
  }
  return [...open.values()];
}

export function updateSummary(r: StudentFlagResult): string {
  const e = r.evidence;
  const bits = r.evidence.rulesFired.map((x) => x.detail);
  if (e.mistakePattern && e.questionBreakdown.length) bits.push(e.mistakePattern);
  return bits.join(" ");
}
