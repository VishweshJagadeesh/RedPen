/**
 * A database-independent view of one section's graded work. Both the Prisma query layer and the
 * fixture generator produce this shape, so every diagnosis rule is a pure, unit-testable function.
 */
import type { AssessmentType, MistakeType } from "../domain";
import { REGULAR_TYPES } from "../domain";

export interface DsQuestion {
  id: string;
  number: number;
  maxMarks: number;
  conceptIds: string[];
}

export interface DsAssessment {
  id: string;
  title: string;
  shortTitle: string;
  type: AssessmentType;
  date: string; // ISO date
  questions: DsQuestion[];
  /** Students expected to submit (remedial assignments target a subset). Undefined = whole section. */
  expectedStudentIds?: string[];
}

export interface DsAnswer {
  questionId: string;
  marks: number;
  maxMarks: number;
  mistakeType: MistakeType;
  misconception: string | null;
  transcription: string;
}

export interface DsSubmission {
  assessmentId: string;
  studentId: string;
  absent: boolean;
  answers: DsAnswer[];
}

export interface DsStudent {
  id: string;
  name: string;
  rollNumber: number;
}

export interface DsConcept {
  id: string;
  name: string;
  chapter: string;
}

export interface SectionDataset {
  sectionId: string;
  sectionName: string;
  students: DsStudent[];
  concepts: DsConcept[];
  /** Only finalised assessments, sorted by date ascending. */
  assessments: DsAssessment[];
  submissions: DsSubmission[];
}

export function isRegular(a: DsAssessment): boolean {
  return REGULAR_TYPES.includes(a.type);
}

/** Assessments that measure the whole class (excludes per-student remedial work). */
export function isClassWide(a: DsAssessment): boolean {
  return a.type !== "remedial";
}

export function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export class DatasetIndex {
  readonly byAssessment = new Map<string, DsAssessment>();
  readonly subs = new Map<string, DsSubmission>(); // `${assessmentId}:${studentId}`
  readonly questionById = new Map<string, DsQuestion>();

  constructor(readonly ds: SectionDataset) {
    for (const a of ds.assessments) {
      this.byAssessment.set(a.id, a);
      for (const q of a.questions) this.questionById.set(q.id, q);
    }
    for (const s of ds.submissions) this.subs.set(`${s.assessmentId}:${s.studentId}`, s);
  }

  submission(assessmentId: string, studentId: string): DsSubmission | undefined {
    return this.subs.get(`${assessmentId}:${studentId}`);
  }

  /** Percentage score of a student on an assessment, or null if absent / not submitted. */
  scorePct(assessmentId: string, studentId: string): number | null {
    const sub = this.submission(assessmentId, studentId);
    if (!sub || sub.absent) return null;
    const a = this.byAssessment.get(assessmentId);
    if (!a) return null;
    const max = a.questions.reduce((s, q) => s + q.maxMarks, 0);
    const got = sub.answers.reduce((s, x) => s + x.marks, 0);
    return max > 0 ? (got / max) * 100 : null;
  }

  marks(assessmentId: string, studentId: string): { got: number; max: number } | null {
    const sub = this.submission(assessmentId, studentId);
    if (!sub || sub.absent) return null;
    const a = this.byAssessment.get(assessmentId);
    if (!a) return null;
    return {
      got: sub.answers.reduce((s, x) => s + x.marks, 0),
      max: a.questions.reduce((s, q) => s + q.maxMarks, 0),
    };
  }

  /** Marks on a concept in one assessment: sums over every question tagged with it. */
  conceptMarks(assessmentId: string, studentId: string, conceptId: string): { got: number; max: number } | null {
    const a = this.byAssessment.get(assessmentId);
    if (!a) return null;
    const qs = a.questions.filter((q) => q.conceptIds.includes(conceptId));
    if (qs.length === 0) return null;
    const sub = this.submission(assessmentId, studentId);
    if (!sub || sub.absent) return null;
    let got = 0;
    let max = 0;
    for (const q of qs) {
      const ans = sub.answers.find((x) => x.questionId === q.id);
      max += q.maxMarks;
      got += ans?.marks ?? 0;
    }
    return { got, max };
  }

  conceptMaxInAssessment(assessmentId: string, conceptId: string): number {
    const a = this.byAssessment.get(assessmentId);
    if (!a) return 0;
    return a.questions.filter((q) => q.conceptIds.includes(conceptId)).reduce((s, q) => s + q.maxMarks, 0);
  }

  answersOnConcept(assessmentId: string, studentId: string, conceptId: string): { q: DsQuestion; ans: DsAnswer }[] {
    const a = this.byAssessment.get(assessmentId);
    const sub = this.submission(assessmentId, studentId);
    if (!a || !sub || sub.absent) return [];
    const out: { q: DsQuestion; ans: DsAnswer }[] = [];
    for (const q of a.questions) {
      if (!q.conceptIds.includes(conceptId)) continue;
      const ans = sub.answers.find((x) => x.questionId === q.id);
      if (ans) out.push({ q, ans });
    }
    return out;
  }

  /** Students expected to sit an assessment. */
  expected(a: DsAssessment): string[] {
    return a.expectedStudentIds ?? this.ds.students.map((s) => s.id);
  }
}

export function pct(got: number, max: number): number {
  return max > 0 ? (got / max) * 100 : 0;
}

export function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Linear-interpolated percentile, p in 0..100. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
