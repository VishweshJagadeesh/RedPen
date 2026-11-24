import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { saveQuestions } from "@/lib/services/assessments";

const Body = z.object({
  confirm: z.boolean().default(false),
  questions: z
    .array(
      z.object({
        number: z.number().int().positive(),
        text: z.string().min(1),
        maxMarks: z.number().positive(),
        rubric: z.array(z.object({ step: z.string().min(1), marks: z.number().positive() })).min(1),
        answerKey: z.string(),
        conceptIds: z.array(z.string()),
      }),
    )
    .min(1, "Add at least one question"),
});

export const PUT = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const numbers = body.questions.map((q) => q.number);
  if (new Set(numbers).size !== numbers.length) throw new Error("Question numbers must be unique.");
  await saveQuestions(id, body.questions, body.confirm);
  return { ok: true };
});
