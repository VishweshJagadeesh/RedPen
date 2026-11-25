import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { saveAssessmentDraft } from "@/lib/services/assessments";

// Drafts may be half-edited, so this is looser than PUT /questions (which confirms them).
const Question = z.object({
  number: z.number().int(),
  text: z.string(),
  maxMarks: z.number(),
  rubric: z.array(z.object({ step: z.string(), marks: z.number() })),
  answerKey: z.string(),
  conceptIds: z.array(z.string()),
});

/** "Save draft & leave": optional unsaved questions (kept unconfirmed), then mark the draft as kept. */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = z.object({ questions: z.array(Question).optional() }).parse(await req.json().catch(() => ({})));
  const questions = body.questions?.filter((q) => q.number > 0);
  await saveAssessmentDraft(id, questions && questions.length && new Set(questions.map((q) => q.number)).size === questions.length ? questions : undefined);
  return { ok: true };
});
