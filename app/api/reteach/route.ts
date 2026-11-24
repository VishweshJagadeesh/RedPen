import { z } from "zod";
import { handle } from "@/lib/api";
import { createPlan } from "@/lib/planner/service";

export const maxDuration = 120;

const Body = z.object({
  sectionId: z.string(),
  conceptId: z.string(),
  inputs: z.object({
    periodMinutes: z.number().int().min(20).max(90),
    resources: z.enum(["blackboard", "projector", "worksheets"]),
    language: z.enum(["en", "hi", "mixed"]),
    note: z.string().max(500).default(""),
  }),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  return { id: await createPlan(body.sectionId, body.conceptId, body.inputs) };
});
