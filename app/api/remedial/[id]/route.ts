import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { discardRemedial, saveRemedialQuestions, type RemedialQuestion } from "@/lib/remedial/service";

const Q = z.object({
  id: z.string(),
  text: z.string().min(1),
  answer: z.string(),
  marks: z.number().positive(),
  rubric: z.array(z.object({ step: z.string(), marks: z.number() })),
  difficulty: z.number(),
  conceptId: z.string(),
  targetsMistake: z.string(),
  sourceAssessmentId: z.string().nullable(),
  sourceQuestionNumber: z.number().nullable(),
});

export const PATCH = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { questions } = z.object({ questions: z.array(Q) }).parse(await req.json());
  await saveRemedialQuestions(id, questions as RemedialQuestion[]);
  return { ok: true };
});

/** "Discard": deletes a sheet that was never assigned. */
export const DELETE = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  await discardRemedial(id);
  return { ok: true };
});
