import { z } from "zod";
import { handle } from "@/lib/api";
import { createRemedial } from "@/lib/remedial/service";

export const maxDuration = 120;

const Body = z.object({
  sectionId: z.string(),
  studentIds: z.array(z.string()).min(1, "Choose at least one student"),
  conceptIds: z.array(z.string()).min(1, "Choose at least one concept"),
  count: z.number().int().min(5).max(10),
  mode: z.enum(["group", "individual"]),
  flagId: z.string().nullable(),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  return { ids: await createRemedial(body) };
});
