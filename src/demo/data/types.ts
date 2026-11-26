/**
 * The walkthrough's data snapshot. Built on the server from the seed fixtures by the app's own pure
 * functions (see build.ts), so every number on screen is a number the seeded app would show.
 * JSON-serialisable: it is passed from the /demo server page to the client stage.
 */
import type { QuestionDraftView } from "@/components/grading/QuestionConfirmTable";
import type { MatchSheetView } from "@/components/grading/SheetMatcher";
import type { GradingProgressView } from "@/components/grading/GradingProgress";
import type { FlagListItem } from "@/components/diagnosis/FlaggedStudentsList";
import type { TrendPoint } from "@/components/charts/TrendLineChart";
import type { ReviewItem } from "@/lib/grading/review-items";
import type { HeatmapData } from "@/lib/diagnosis/mastery";
import type { WeakConceptView } from "@/lib/queries/section";
import type { PlanEvidence, PlanInputs, PlanSection } from "@/lib/planner/types";
import type { RemedialQuestion } from "@/lib/remedial/questions";
import type { FlagDetail } from "@/lib/queries/alerts";
import type { PtmSummaryData } from "@/lib/ptm/summary";
import type { ConfidenceBand } from "@/lib/domain";

export interface DemoStudent {
  id: string;
  name: string;
  rollNumber: number;
}

/** One sheet as the grading pipeline finishes it (in grading order). */
export interface GradedSheetStep {
  submissionId: string;
  studentName: string;
  band: ConfidenceBand;
  marks: number;
  maxMarks: number;
  answerBands: ConfidenceBand[];
}

export interface DemoData {
  teacher: { name: string; subject: string; sections: string[]; studentCount: number };
  section: { id: string; name: string; students: DemoStudent[] };
  grade: {
    assessmentId: string;
    title: string;
    shortTitle: string;
    date: string;
    sheetCount: number;
    pageCount: number;
    /** What the mock AI reads from the question paper (the Questions step). */
    questions: QuestionDraftView[];
    concepts: { id: string; name: string; chapter: string }[];
    /** Real sample images and their sizes, for the capture step. */
    paperImage: { url: string; bytes: number };
    keyImage: { url: string; bytes: number };
    sheets: MatchSheetView[];
    roster: DemoStudent[];
    gradingOrder: GradedSheetStep[];
    totalAnswers: number;
    finalProgress: GradingProgressView;
    reviewItems: ReviewItem[];
    /** The answers the walkthrough reviews by hand, in queue order. */
    messyId: string;
    messyFinalAwards: number[];
    nextId: string;
  };
  reteach: {
    conceptId: string;
    heatmap: HeatmapData;
    weakConceptIds: string[];
    card: WeakConceptView;
    /** Per-student mastery on the concept (for the classroom rings), before and after the reteach. */
    before: Record<string, number>;
    after: Record<string, number>;
    evidence: PlanEvidence;
    inputs: PlanInputs;
    defaultPeriod: number;
    /** The generation steps as the server streams them (label, detail). */
    generation: { id: string; label: string; detail?: string }[];
    sections: PlanSection[];
    teachingSteps: PlanSection[];
    boardPlan: string | null;
    exitTicket: { title: string; sheets: number; answers: number; progress: GradingProgressView };
    cardAfter: WeakConceptView;
    taughtDate: string;
  };
  remediate: {
    flags: FlagListItem[];
    rohan: FlagDetail;
    sneha: FlagDetail;
    imranId: string;
    builder: {
      roster: { id: string; name: string; rollNumber: number; hint?: string }[];
      concepts: { id: string; name: string; chapter: string }[];
      conceptIds: string[];
      defaultCount: number;
      count: number;
      title: string;
      questions: RemedialQuestion[];
    };
    sheet: { title: string; imageUrl: string; reviewItems: ReviewItem[]; marks: number; maxMarks: number; finaliseNote: string; assignedDate: string };
    rohanAfter: FlagDetail;
  };
  ptm: {
    student: { name: string; firstName: string; section: string; rollNumber: number };
    trend: TrendPoint[];
    summary: PtmSummaryData;
    sources: Record<string, { label: string; href: string | null }>;
    parentName: string;
  };
}
