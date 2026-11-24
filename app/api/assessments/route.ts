import { z } from "zod";
import { handle } from "@/lib/api";
import { ASSESSMENT_TYPES } from "@/lib/domain";
import { createAssessment, samplePaperFor, storeUpload } from "@/lib/services/assessments";

const Body = z.object({
  sectionId: z.string().min(1),
  title: z.string().min(1, "Give the assessment a title"),
  type: z.enum(ASSESSMENT_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sample: z.string().optional(),
});

/** Step 1: create the assessment with its question paper and answer key (photos or PDF). */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const body = Body.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  let paperKeys: string[] = [];
  let keyKeys: string[] = [];
  let fixtureKey: string | null = null;
  if (body.sample) {
    const sample = samplePaperFor(body.sample);
    if (!sample) throw new Error("Unknown sample paper");
    paperKeys = sample.paper;
    keyKeys = sample.key;
    fixtureKey = body.sample;
  } else {
    const paper = form.getAll("paper").filter((f): f is File => f instanceof File && f.size > 0);
    const key = form.getAll("key").filter((f): f is File => f instanceof File && f.size > 0);
    if (paper.length === 0) throw new Error("Upload the question paper (photos or a PDF).");
    if (key.length === 0) throw new Error("Upload the answer key (photos or a PDF).");
    paperKeys = await Promise.all(paper.map((f) => storeUpload("papers", f)));
    keyKeys = await Promise.all(key.map((f) => storeUpload("keys", f)));
  }
  const a = await createAssessment({ ...body, paperKeys, keyKeys, fixtureKey });
  return { id: a.id };
});
