/** Serves the generated practice sheets (lib/fixtures/synthetic.ts) as SVG pages. */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { parseSyntheticKey, parseSyntheticRef, renderSyntheticPage } from "../fixtures/synthetic";
import type { RubricStep } from "../domain";
import type { StoredFile } from "../storage";

let font: Promise<string | null> | null = null;

function handwritingFont() {
  font ??= fs
    .readFile(path.join(process.cwd(), "node_modules/@fontsource/kalam/files/kalam-latin-400-normal.woff2"))
    .then((b) => `data:font/woff2;base64,${b.toString("base64")}`)
    .catch(() => null);
  return font;
}

export async function syntheticPage(key: string): Promise<StoredFile | null> {
  const parsed = parseSyntheticKey(key);
  if (!parsed) return null;
  const sub = await prisma.submission.findUnique({
    where: { id: parsed.submissionId },
    include: { assessment: { include: { section: true, questions: { orderBy: { number: "asc" } } } } },
  });
  const ref = parseSyntheticRef(sub?.sheetRef);
  if (!sub || !ref) return null;
  const student = await prisma.student.findUnique({ where: { id: ref.studentId } });
  if (!student) return null;
  const svg = renderSyntheticPage({
    ref,
    studentName: student.name,
    rollNumber: student.rollNumber,
    sectionName: sub.assessment.section.name,
    title: sub.assessment.title,
    page: parsed.page,
    fontDataUrl: await handwritingFont(),
    questions: sub.assessment.questions.map((q) => ({
      number: q.number,
      text: q.text,
      rubric: parseJson<RubricStep[]>(q.rubric, []),
      answerKey: q.answerKey,
      conceptIds: parseJson<string[]>(q.conceptIds, []),
    })),
  });
  return { data: Buffer.from(svg), contentType: "image/svg+xml" };
}
