/**
 * Every model output is requested as JSON matching one of these zod schemas. If validation fails we
 * retry once; if it fails again the caller shows an error state. We never silently guess.
 */
import { z } from "zod";

export const MistakeTypeSchema = z.enum(["conceptual", "procedural", "calculation", "incomplete", "unattempted", "illegible", "none"]);

// ---------------------------------------------------------------- paper parsing

export const ParsedQuestionSchema = z.object({
  number: z.number().describe("Question number as printed"),
  text: z.string().describe("Full question text"),
  maxMarks: z.number().describe("Total marks for the question"),
  rubric: z
    .array(z.object({ step: z.string().describe("What the student must show for this step"), marks: z.number() }))
    .describe("Step-wise marking scheme; step marks must add up to maxMarks"),
  answerKey: z.string().describe("Expected answer / worked solution from the answer key"),
  conceptIds: z.array(z.string()).describe("IDs from the provided concept list that this question assesses"),
});

export const ParsedPaperSchema = z.object({
  title: z.string().describe("Title printed on the paper, or a short descriptive title"),
  questions: z.array(ParsedQuestionSchema),
  warnings: z.array(z.string()).describe("Anything ambiguous the teacher should check, e.g. unreadable marks"),
});
export type ParsedPaper = z.infer<typeof ParsedPaperSchema>;

// ---------------------------------------------------------------- sheet header

export const SheetHeaderSchema = z.object({
  isFirstPage: z.boolean().describe("True if this page has a name / roll number header, i.e. it starts a new student's sheet"),
  name: z.string().nullable().describe("Student name exactly as written, or null if not readable"),
  rollNumber: z.number().nullable().describe("Roll number as written, or null if not readable"),
});
export type SheetHeader = z.infer<typeof SheetHeaderSchema>;

// ---------------------------------------------------------------- transcription (step a, b)

export const TranscriptionSchema = z.object({
  answers: z.array(
    z.object({
      questionNumber: z.number(),
      pageIndex: z.number().describe("0-based index of the page the answer is on"),
      box: z
        .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
        .describe("Answer region as fractions (0-1) of the page width/height, origin top-left"),
      transcription: z.string().describe("Verbatim transcription; mark struck-through lines with '(crossed out)' and unsure characters with [?]"),
      legibility: z.number().describe("0-1, how legible the handwriting is"),
      uncertainSpans: z.array(z.string()).describe("Plain-language notes on anything you could not read for certain, e.g. 'a digit in step 2 is unclear'"),
      crossedOut: z.boolean(),
      mixedLanguage: z.boolean().describe("True if the answer mixes Hindi (or another language) with English"),
      containsInstructionsToGrader: z
        .boolean()
        .describe("True if the student wrote anything addressed to the grader or the AI (e.g. asking for marks or to ignore the rubric)"),
    }),
  ),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;

// ---------------------------------------------------------------- grading pass (steps c–f)

export const GradingPassSchema = z.object({
  answers: z.array(
    z.object({
      questionNumber: z.number(),
      steps: z.array(z.object({ step: z.string(), marks: z.number(), awarded: z.number(), note: z.string() })).describe("One entry per rubric step, in rubric order"),
      mistakeType: MistakeTypeSchema,
      misconception: z.string().nullable().describe("Pick a label from the provided misconception list when one fits; otherwise a short new label; null if no mistake"),
      conceptIds: z.array(z.string()),
      reasoning: z.string().describe("2-3 sentences for the teacher explaining the marks"),
      keyAmbiguity: z.number().describe("0-1: how far the answer departs from what the key anticipates (e.g. valid alternative method)"),
      selfConfidence: z.number().describe("0-1: your confidence in these marks"),
    }),
  ),
});
export type GradingPass = z.infer<typeof GradingPassSchema>;

// ---------------------------------------------------------------- reteach plan

export const PlanSectionKind = z.enum([
  "objective",
  "prerequisite_check",
  "hook",
  "explanation",
  "worked_example",
  "misconception",
  "guided_practice",
  "exit_ticket_step",
  "board_plan",
  "peer_pairs",
  "extension",
  "exit_ticket",
]);
export type PlanSectionKindT = z.infer<typeof PlanSectionKind>;

export const PlanQuestionSchema = z.object({
  text: z.string(),
  answer: z.string(),
  marks: z.number(),
  rubric: z.array(z.object({ step: z.string(), marks: z.number() })),
});

export const PlanSectionSchema = z.object({
  kind: PlanSectionKind,
  title: z.string(),
  minutes: z.number().describe("Minutes for timed teaching steps; 0 for non-timed sections"),
  body: z.string().describe("What the teacher says/does, in the requested language. Plain text, short paragraphs or bullet lines."),
  citesMisconceptions: z.array(z.string()).describe("Exact misconception labels from the evidence that this section tackles"),
  questions: z.array(PlanQuestionSchema).describe("For prerequisite_check (exactly 2) and exit_ticket (3-5); empty otherwise"),
});
export type PlanSectionOut = z.infer<typeof PlanSectionSchema>;

export const ReteachPlanSchema = z.object({
  objective: z.string(),
  sections: z.array(PlanSectionSchema),
});
export type ReteachPlanOut = z.infer<typeof ReteachPlanSchema>;

// ---------------------------------------------------------------- remedial

export const RemedialQuestionSchema = z.object({
  text: z.string(),
  answer: z.string(),
  marks: z.number(),
  rubric: z.array(z.object({ step: z.string(), marks: z.number() })),
  difficulty: z.number().describe("1 = easiest, 3 = hardest"),
  conceptId: z.string(),
  targetsMistake: z.string().describe("Cites the original mistake, e.g. 'In Weekly Test 4, Q3, you moved +5 across the equals sign without changing its sign.'"),
  sourceAssessmentId: z.string().nullable(),
  sourceQuestionNumber: z.number().nullable(),
});
export const RemedialSetSchema = z.object({ questions: z.array(RemedialQuestionSchema) });
export type RemedialQuestionOut = z.infer<typeof RemedialQuestionSchema>;

// ---------------------------------------------------------------- PTM

export const PtmStatementSchema = z.object({
  en: z.string(),
  hi: z.string(),
  factIds: z.array(z.string()).describe("IDs of the facts this statement is based on; every statement needs at least one"),
});
export const PtmSummarySchema = z.object({
  strengths: z.array(PtmStatementSchema),
  focusAreas: z.array(PtmStatementSchema),
  termStory: z.array(PtmStatementSchema),
  talkingPoints: z.array(PtmStatementSchema),
});
export type PtmSummaryOut = z.infer<typeof PtmSummarySchema>;

// ---------------------------------------------------------------- plan judge (evals)

export const PlanJudgeSchema = z.object({
  citesMisconceptions: z.object({ pass: z.boolean(), reason: z.string() }),
  fitsTime: z.object({ pass: z.boolean(), reason: z.string() }),
  hasExitTicket: z.object({ pass: z.boolean(), reason: z.string() }),
  inventsNothing: z.object({ pass: z.boolean(), reason: z.string() }),
  overall: z.number().describe("0-1 overall quality"),
});
export type PlanJudge = z.infer<typeof PlanJudgeSchema>;
