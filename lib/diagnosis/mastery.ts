/** Concept mastery, class-wide weak concepts, heatmap and trends — pure functions over a dataset. */
import { config } from "../config";
import { conceptShort } from "../fixtures/concepts";
import { MISTAKE_LABEL, type MistakeType } from "../domain";
import {
  DatasetIndex,
  isClassWide,
  isRegular,
  pct,
  round,
  type DsAssessment,
  type SectionDataset,
} from "./dataset";

type DiagnosisConfig = typeof config.diagnosis;

export interface ConceptWindow {
  got: number;
  max: number;
  pct: number;
  assessmentIds: string[];
}

/**
 * A student's current mastery of a concept: walk back from their most recent assessment that
 * covered it, accumulating marks until there is enough evidence (minConceptMarks).
 */
export function studentConceptMastery(
  idx: DatasetIndex,
  studentId: string,
  conceptId: string,
  opts: { classWideOnly?: boolean; minMarks?: number } = {},
): ConceptWindow | null {
  const minMarks = opts.minMarks ?? config.diagnosis.minConceptMarks;
  let got = 0;
  let max = 0;
  const ids: string[] = [];
  const list = [...idx.ds.assessments].reverse();
  for (const a of list) {
    if (opts.classWideOnly && !isClassWide(a)) continue;
    const m = idx.conceptMarks(a.id, studentId, conceptId);
    if (!m) continue;
    got += m.got;
    max += m.max;
    ids.push(a.id);
    if (max >= minMarks) break;
  }
  if (max === 0) return null;
  return { got, max, pct: pct(got, max), assessmentIds: ids };
}

export interface TimelinePoint {
  assessmentId: string;
  title: string;
  shortTitle: string;
  date: string;
  type: DsAssessment["type"];
  pct: number;
  got: number;
  max: number;
}

export function studentConceptTimeline(idx: DatasetIndex, studentId: string, conceptId: string): TimelinePoint[] {
  const out: TimelinePoint[] = [];
  for (const a of idx.ds.assessments) {
    const m = idx.conceptMarks(a.id, studentId, conceptId);
    if (!m) continue;
    out.push({ assessmentId: a.id, title: a.title, shortTitle: a.shortTitle, date: a.date, type: a.type, pct: pct(m.got, m.max), got: m.got, max: m.max });
  }
  return out;
}

export function studentScoreSeries(idx: DatasetIndex, studentId: string, opts: { regularOnly?: boolean } = {}) {
  return idx.ds.assessments
    .filter((a) => (opts.regularOnly ?? true ? isRegular(a) : true))
    .filter((a) => idx.expected(a).includes(studentId))
    .map((a) => {
      const m = idx.marks(a.id, studentId);
      return {
        assessmentId: a.id,
        title: a.title,
        shortTitle: a.shortTitle,
        date: a.date,
        type: a.type,
        pct: m ? pct(m.got, m.max) : null,
        got: m?.got ?? null,
        max: m?.max ?? a.questions.reduce((s, q) => s + q.maxMarks, 0),
      };
    });
}

export function sectionTrend(idx: DatasetIndex) {
  return idx.ds.assessments.filter(isRegular).map((a) => {
    const scores = idx.ds.students
      .map((s) => idx.scorePct(a.id, s.id))
      .filter((x): x is number => x !== null);
    const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    return { assessmentId: a.id, title: a.title, shortTitle: a.shortTitle, date: a.date, average: round(avg, 1), submitted: scores.length };
  });
}

/** Concepts that appear in any of the section's assessments, in tree order. */
export function coveredConceptIds(ds: SectionDataset): string[] {
  const seen = new Set<string>();
  for (const a of ds.assessments) for (const q of a.questions) for (const c of q.conceptIds) seen.add(c);
  return ds.concepts.filter((c) => seen.has(c.id)).map((c) => c.id);
}

export interface MisconceptionCount {
  label: string;
  count: number;
}

export interface ConceptSnippet {
  text: string;
  misconception: string;
  assessmentId: string;
  assessmentTitle: string;
  questionId: string;
  questionNumber: number;
}

export interface ClassConceptSummary {
  conceptId: string;
  conceptName: string;
  chapter: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentDate: string;
  assessmentType: DsAssessment["type"];
  studentsAssessed: number;
  studentsUnder: number;
  shareUnder: number; // 0..1
  meanPct: number;
  isWeak: boolean;
  misconceptions: MisconceptionCount[];
  snippets: ConceptSnippet[];
  perStudent: { studentId: string; pct: number; dominant: string | null }[];
  /** Class mean on this concept for every class-wide assessment that covered it. */
  history: { assessmentId: string; title: string; shortTitle: string; date: string; type: DsAssessment["type"]; meanPct: number }[];
}

function dominantIssue(
  idx: DatasetIndex,
  assessmentId: string,
  studentId: string,
  conceptId: string,
): string | null {
  const weights = new Map<string, number>();
  for (const { ans } of idx.answersOnConcept(assessmentId, studentId, conceptId)) {
    const lost = ans.maxMarks - ans.marks;
    if (lost <= 0) continue;
    const label = ans.misconception ?? (ans.mistakeType === "none" ? null : issueForMistake(ans.mistakeType));
    if (!label) continue;
    weights.set(label, (weights.get(label) ?? 0) + lost);
  }
  // A named misconception (what the student actually did wrong) outranks blank or generic
  // mistakes; among named ones, the one that cost the most marks wins.
  const generic = new Set<string>([UNATTEMPTED_LABEL, ...Object.values(MISTAKE_LABEL)]);
  let best: string | null = null;
  let bestKey = [-1, -1];
  for (const [label, w] of weights) {
    const key = [generic.has(label) ? 0 : 1, w];
    if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      best = label;
      bestKey = key;
    }
  }
  return best;
}

export const UNATTEMPTED_LABEL = "Left the question unattempted";

function issueForMistake(t: MistakeType): string {
  if (t === "unattempted") return UNATTEMPTED_LABEL;
  return MISTAKE_LABEL[t];
}

export function classConceptSummary(
  idx: DatasetIndex,
  conceptId: string,
  cfg: DiagnosisConfig = config.diagnosis,
): ClassConceptSummary | null {
  const concept = idx.ds.concepts.find((c) => c.id === conceptId);
  const covering = idx.ds.assessments.filter(
    (a) => isClassWide(a) && idx.conceptMaxInAssessment(a.id, conceptId) >= cfg.minConceptMarks,
  );
  if (covering.length === 0) return null;

  const history = covering.map((a) => {
    const vals = idx.ds.students
      .map((s) => idx.conceptMarks(a.id, s.id, conceptId))
      .filter((m): m is { got: number; max: number } => m !== null)
      .map((m) => pct(m.got, m.max));
    return {
      assessmentId: a.id,
      title: a.title,
      shortTitle: a.shortTitle,
      date: a.date,
      type: a.type,
      meanPct: vals.length ? round(vals.reduce((s, v) => s + v, 0) / vals.length, 1) : 0,
    };
  });

  const latest = covering[covering.length - 1];
  const perStudent: ClassConceptSummary["perStudent"] = [];
  for (const s of idx.ds.students) {
    const m = idx.conceptMarks(latest.id, s.id, conceptId);
    if (!m) continue;
    const p = pct(m.got, m.max);
    perStudent.push({ studentId: s.id, pct: p, dominant: p < cfg.weakScore ? dominantIssue(idx, latest.id, s.id, conceptId) : null });
  }
  const under = perStudent.filter((p) => p.pct < cfg.weakScore);
  const counts = new Map<string, number>();
  for (const p of under) if (p.dominant) counts.set(p.dominant, (counts.get(p.dominant) ?? 0) + 1);
  const misconceptions = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Anonymised example snippets: one real answer per top misconception.
  const snippets: ConceptSnippet[] = [];
  for (const m of misconceptions.slice(0, 3)) {
    if (m.label === UNATTEMPTED_LABEL) continue;
    const student = under.find((p) => p.dominant === m.label);
    if (!student) continue;
    const hit = idx
      .answersOnConcept(latest.id, student.studentId, conceptId)
      .find(({ ans }) => (ans.misconception ?? "") === m.label && ans.transcription.trim().length > 0);
    if (hit) {
      snippets.push({
        text: hit.ans.transcription,
        misconception: m.label,
        assessmentId: latest.id,
        assessmentTitle: latest.title,
        questionId: hit.q.id,
        questionNumber: hit.q.number,
      });
    }
  }

  const meanPct = perStudent.length ? perStudent.reduce((s, p) => s + p.pct, 0) / perStudent.length : 0;
  const shareUnder = perStudent.length ? under.length / perStudent.length : 0;
  return {
    conceptId,
    conceptName: concept?.name ?? conceptId,
    chapter: concept?.chapter ?? "",
    assessmentId: latest.id,
    assessmentTitle: latest.title,
    assessmentDate: latest.date,
    assessmentType: latest.type,
    studentsAssessed: perStudent.length,
    studentsUnder: under.length,
    shareUnder,
    meanPct: round(meanPct, 1),
    isWeak: shareUnder >= cfg.classWeakShare,
    misconceptions,
    snippets,
    perStudent,
    history,
  };
}

export function allClassConceptSummaries(idx: DatasetIndex, cfg: DiagnosisConfig = config.diagnosis) {
  return coveredConceptIds(idx.ds)
    .map((id) => classConceptSummary(idx, id, cfg))
    .filter((x): x is ClassConceptSummary => x !== null);
}

export function classWeakConcepts(idx: DatasetIndex, cfg: DiagnosisConfig = config.diagnosis) {
  return allClassConceptSummaries(idx, cfg)
    .filter((s) => s.isWeak)
    .sort((a, b) => b.shareUnder - a.shareUnder);
}

export interface HeatmapData {
  concepts: { id: string; name: string; shortName: string; chapter: string; classMean: number }[];
  rows: { studentId: string; name: string; rollNumber: number; cells: (number | null)[] }[];
}

export function conceptHeatmap(idx: DatasetIndex): HeatmapData {
  const conceptIds = coveredConceptIds(idx.ds);
  const cellsByStudent = idx.ds.students.map((s) => ({
    student: s,
    cells: conceptIds.map((c) => {
      const w = studentConceptMastery(idx, s.id, c);
      return w ? round(w.pct) : null;
    }),
  }));
  const concepts = conceptIds.map((id, i) => {
    const vals = cellsByStudent.map((r) => r.cells[i]).filter((v): v is number => v !== null);
    const c = idx.ds.concepts.find((x) => x.id === id);
    return {
      id,
      name: c?.name ?? id,
      chapter: c?.chapter ?? "",
      classMean: vals.length ? round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0,
      index: i,
    };
  });
  concepts.sort((a, b) => a.classMean - b.classMean);
  return {
    concepts: concepts.map(({ id, name, chapter, classMean }) => ({ id, name, shortName: conceptShort(id, name), chapter, classMean })),
    rows: cellsByStudent.map((r) => ({
      studentId: r.student.id,
      name: r.student.name,
      rollNumber: r.student.rollNumber,
      cells: concepts.map((c) => r.cells[c.index]),
    })),
  };
}

/** Peer pairs for a reteach: strong students mentor up to N students who have not mastered the concept. */
export function suggestPeerPairs(
  summary: ClassConceptSummary,
  students: { id: string; name: string }[],
  cfg: DiagnosisConfig = config.diagnosis,
  shuffleSeed = 0,
) {
  const name = (id: string) => students.find((s) => s.id === id)?.name ?? id;
  const mentors = summary.perStudent.filter((p) => p.pct >= cfg.mentorScore).sort((a, b) => b.pct - a.pct || a.studentId.localeCompare(b.studentId));
  const learners = summary.perStudent.filter((p) => p.pct < cfg.weakScore).sort((a, b) => a.pct - b.pct || a.studentId.localeCompare(b.studentId));
  if (shuffleSeed) rotate(learners, shuffleSeed);
  const groups = mentors.map((m) => ({
    mentorId: m.studentId,
    mentorName: name(m.studentId),
    mentorPct: round(m.pct),
    learners: [] as { id: string; name: string; pct: number }[],
  }));
  let i = 0;
  for (let round_ = 0; round_ < cfg.maxLearnersPerMentor; round_++) {
    for (const g of groups) {
      if (i >= learners.length) break;
      const l = learners[i++];
      g.learners.push({ id: l.studentId, name: name(l.studentId), pct: round(l.pct) });
    }
  }
  const unpaired = learners.slice(i).map((l) => ({ id: l.studentId, name: name(l.studentId), pct: round(l.pct) }));
  return { groups: groups.filter((g) => g.learners.length > 0), unpaired };
}

function rotate<T>(arr: T[], by: number) {
  if (arr.length === 0) return;
  const k = by % arr.length;
  const head = arr.splice(0, k);
  arr.push(...head);
}


/** Latest test average, its change, and a health band for the class trend. */
export function classHealth(avg: number | null, cfg: DiagnosisConfig = config.diagnosis): "healthy" | "critical" | "poor" | null {
  if (avg === null) return null;
  return avg >= cfg.classHealthy ? "healthy" : avg >= cfg.classCritical ? "critical" : "poor";
}

export interface HomeworkSummary {
  assessmentId: string;
  title: string;
  shortTitle: string;
  date: string;
  average: number;
  submitted: number;
  expected: number;
  /** enoughEvidence: the concept had at least minConceptMarks on this homework (otherwise not used for weak detection). */
  concepts: { id: string; name: string; meanPct: number; shareUnder: number; marks: number; enoughEvidence: boolean }[];
}

/** Homework shows whether a topic taught in class landed: average, completion and per-concept understanding. */
export function homeworkSummaries(idx: DatasetIndex, cfg: DiagnosisConfig = config.diagnosis): HomeworkSummary[] {
  return idx.ds.assessments
    .filter((a) => a.type === "homework")
    .map((a) => {
      const scores = idx.ds.students.map((s) => idx.scorePct(a.id, s.id)).filter((v): v is number => v !== null);
      const conceptIds = [...new Set(a.questions.flatMap((q) => q.conceptIds))];
      return {
        assessmentId: a.id,
        title: a.title,
        shortTitle: a.shortTitle,
        date: a.date,
        average: round(scores.length ? scores.reduce((t, v) => t + v, 0) / scores.length : 0, 1),
        submitted: scores.length,
        expected: idx.expected(a).length,
        concepts: conceptIds.map((cid) => {
          const vals = idx.ds.students.map((s) => idx.conceptMarks(a.id, s.id, cid)).filter((m): m is { got: number; max: number } => m !== null).map((m) => pct(m.got, m.max));
          const c = idx.ds.concepts.find((x) => x.id === cid);
          const marks = idx.conceptMaxInAssessment(a.id, cid);
          return {
            id: cid,
            name: c?.name ?? cid,
            meanPct: round(vals.length ? vals.reduce((t, v) => t + v, 0) / vals.length : 0),
            shareUnder: vals.length ? vals.filter((v) => v < cfg.weakScore).length / vals.length : 0,
            marks,
            enoughEvidence: marks >= cfg.minConceptMarks,
          };
        }),
      };
    })
    .reverse();
}

export interface RosterRow {
  studentId: string;
  name: string;
  rollNumber: number;
  latestPct: number | null;
  latestTitle: string | null;
  change: number | null;
  series: (number | null)[];
  weakest: { id: string; name: string; pct: number } | null;
  weakOnClassConcepts: string[];
  homework: { submitted: number; total: number; average: number | null };
}

/** One row per student for the searchable class roster. */
export function classRoster(idx: DatasetIndex, weakConceptIds: string[], cfg: DiagnosisConfig = config.diagnosis): RosterRow[] {
  const regular = idx.ds.assessments.filter(isRegular);
  const homework = idx.ds.assessments.filter((a) => a.type === "homework");
  const covered = coveredConceptIds(idx.ds);
  return idx.ds.students.map((s) => {
    const series = regular.map((a) => idx.scorePct(a.id, s.id));
    const taken = regular.map((a, i) => ({ a, pct: series[i] })).filter((x): x is { a: DsAssessment; pct: number } => x.pct !== null);
    const last = taken.at(-1) ?? null;
    const prev = taken.slice(-4, -1);
    const prevAvg = prev.length ? prev.reduce((t, x) => t + x.pct, 0) / prev.length : null;
    let weakest: RosterRow["weakest"] = null;
    const weakOn: string[] = [];
    for (const cid of covered) {
      const w = studentConceptMastery(idx, s.id, cid);
      if (!w || w.max < cfg.minConceptMarks) continue;
      if (!weakest || w.pct < weakest.pct) weakest = { id: cid, name: idx.ds.concepts.find((c) => c.id === cid)?.name ?? cid, pct: round(w.pct) };
      if (weakConceptIds.includes(cid) && w.pct < cfg.weakScore) weakOn.push(cid);
    }
    const hw = homework.map((a) => idx.scorePct(a.id, s.id)).filter((v): v is number => v !== null);
    return {
      studentId: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      latestPct: last ? round(last.pct) : null,
      latestTitle: last?.a.shortTitle ?? null,
      change: last && prevAvg !== null ? round(last.pct - prevAvg) : null,
      series: series.map((v) => (v === null ? null : round(v))),
      weakest,
      weakOnClassConcepts: weakOn,
      homework: { submitted: hw.length, total: homework.length, average: hw.length ? round(hw.reduce((t, v) => t + v, 0) / hw.length) : null },
    };
  });
}
