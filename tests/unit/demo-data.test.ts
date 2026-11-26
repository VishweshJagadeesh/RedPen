/**
 * The walkthrough's snapshot is built from the seed fixtures by the app's own functions. These tests pin
 * the story numbers it shows and check that every number in a caption exists in the data.
 */
import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/src/demo/data/build";
import { SCENES } from "@/src/demo/scenes";

const d = buildDemoData();

describe("walkthrough data snapshot", () => {
  it("flow 1: 52 sheets, 104 pages, 260 answers; sheets 40 High, 9 Medium, 3 Low", () => {
    expect(d.grade.sheetCount).toBe(52);
    expect(d.grade.pageCount).toBe(104);
    expect(d.grade.reviewItems).toHaveLength(260);
    expect(d.grade.finalProgress.sheetBands).toEqual({ high: 40, medium: 9, low: 3 });
    expect(d.grade.sheets.filter((s) => s.needsReview)).toHaveLength(2);
    const messy = d.grade.reviewItems[0];
    expect(messy.id).toBe(d.grade.messyId);
    expect(messy.studentName).toBe("Meera Krishnan");
    expect([messy.awardedMarks, messy.maxMarks]).toEqual([2, 4]);
    expect(d.grade.messyFinalAwards.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("flow 2: 33 of 52 under 50% at 36%, misconceptions 21/8/4, then 36% → 71%", () => {
    expect([d.reteach.card.studentsUnder, d.reteach.card.studentsAssessed, Math.round(d.reteach.card.meanPct)]).toEqual([33, 52, 36]);
    expect(d.reteach.card.misconceptions.map((m) => m.count)).toEqual([21, 8, 4]);
    expect(d.reteach.cardAfter.plan?.beforePct).toBe(36);
    expect(d.reteach.cardAfter.plan?.afterPct).toBe(71);
    expect(Object.values(d.reteach.before).filter((v) => v < 50)).toHaveLength(33);
    expect(d.reteach.sections.some((s) => s.citesMisconceptions.length > 0)).toBe(true);
  });

  it("flow 3: Rohan 76% → 41%, a five-question sheet back at 8/10, alert Improving", () => {
    expect(d.remediate.rohan.evidence?.summary).toMatch(/76% fell to 41%/);
    expect(d.remediate.sneha.evidence?.summary).toMatch(/calculation slips/);
    expect(d.remediate.builder.questions).toHaveLength(d.remediate.builder.count);
    expect(d.remediate.builder.questions.every((q) => q.targetsMistake.startsWith("In "))).toBe(true);
    expect([d.remediate.sheet.marks, d.remediate.sheet.maxMarks]).toEqual([8, 10]);
    expect(d.remediate.rohanAfter.status).toBe("improving");
  });

  it("flow 4: the PTM summary has talking points with sources", () => {
    expect(d.ptm.student.name).toBe("Rohan Kumar");
    expect(d.ptm.summary.talkingPoints.length).toBeGreaterThan(0);
    for (const s of [...d.ptm.summary.strengths, ...d.ptm.summary.focusAreas]) for (const id of s.factIds) expect(d.ptm.sources[id]).toBeDefined();
  });

  it("every caption is at most 90 characters and every number in it comes from the data", () => {
    const json = JSON.stringify(d);
    const known = new Set<string>([...json.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]));
    for (const s of SCENES) {
      expect(s.caption.length, s.title).toBeLessThanOrEqual(90);
      for (const n of s.caption.match(/\d+(?:\.\d+)?/g) ?? []) expect(known.has(n), `${s.title}: ${n}`).toBe(true);
    }
    expect(SCENES.find((s) => s.title === "THE STACK")!.caption).toContain(String(d.teacher.studentCount));
  });

  it("runs about 2.5–3.5 minutes", () => {
    const total = SCENES.reduce((t, s) => t + s.dur + (s.pre ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(150);
    expect(total).toBeLessThanOrEqual(210);
  });
});
