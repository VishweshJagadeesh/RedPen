import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { mockGradeSheet } from "@/lib/ai/mock";
import { PAPER_BY_KEY } from "@/lib/fixtures/papers";
import { studentsOf } from "@/lib/fixtures/school";
import {
  parseSyntheticKey,
  parseSyntheticRef,
  renderSyntheticPage,
  syntheticAbsent,
  syntheticAnswers,
  syntheticPageKeys,
  syntheticSheetRef,
} from "@/lib/fixtures/synthetic";
import { computeConfidence } from "@/lib/grading/confidence";
import { signalsFor } from "@/lib/grading/pipeline";
import { sampleKindFor } from "@/lib/services/assessments";
import { assessmentHref, assessmentStatus, gradeActionLabel } from "@/lib/ui/status";

const hw = PAPER_BY_KEY["c8-hw3"];
const questions = hw.questions.map((q) => ({ number: q.number, text: q.text, rubric: q.rubric, answerKey: q.answerKey, conceptIds: q.conceptIds }));

beforeAll(() => {
  (config.grading as { mockLatencyMs: number }).mockLatencyMs = 0;
});

describe("synthetic sample sheets (mock mode, any assessment)", () => {
  it("round-trips refs and page keys", () => {
    const ref = syntheticSheetRef({ assessmentId: "asm_x1", studentId: "stu_8b_01", ability: 0.734 });
    expect(parseSyntheticRef(ref)).toEqual({ assessmentId: "asm_x1", studentId: "stu_8b_01", ability: 0.73 });
    expect(parseSyntheticRef("8B-WT4-R01")).toBeNull();
    expect(syntheticPageKeys("sub_a_001", 7)).toEqual(["synthetic/sub_a_001/p1.svg", "synthetic/sub_a_001/p2.svg"]);
    expect(parseSyntheticKey("synthetic/sub_a_001/p2.svg")).toEqual({ submissionId: "sub_a_001", page: 1 });
    expect(parseSyntheticKey("synthetic/../etc/p1.svg")).toBeNull();
  });

  it("is deterministic, stays within the rubric and places crops on the page", () => {
    const ref = { assessmentId: "asm_x1", studentId: "stu_8b_05", ability: 0.6 };
    const a = syntheticAnswers(ref, questions);
    expect(syntheticAnswers(ref, questions)).toEqual(a);
    expect(a).toHaveLength(questions.length);
    for (const ans of a) {
      const q = questions.find((x) => x.number === ans.questionNumber)!;
      expect(ans.awards).toHaveLength(q.rubric.length);
      ans.awards.forEach((v, i) => expect(v).toBeLessThanOrEqual(q.rubric[i].marks));
      expect(ans.crop.y + ans.crop.h).toBeLessThanOrEqual(1);
      if (ans.mistakeType === "unattempted") expect(ans.lines).toHaveLength(0);
    }
  });

  it("better students score higher on average", () => {
    const total = (ability: number) =>
      studentsOf("sec_8b").reduce((s, st) => s + syntheticAnswers({ assessmentId: "asm_x2", studentId: st.id, ability }, questions).flatMap((x) => x.awards).reduce((a, b) => a + b, 0), 0);
    expect(total(0.85)).toBeGreaterThan(total(0.4));
  });

  it("grades through the mock AI with mostly High-confidence sheets and a few for review", async () => {
    const bands = { high: 0, medium: 0, low: 0 };
    for (const st of studentsOf("sec_8b")) {
      const res = await mockGradeSheet({
        sheetRef: syntheticSheetRef({ assessmentId: "asm_x3", studentId: st.id, ability: 0.65 }),
        pageKeys: [],
        pages: [],
        concepts: [],
        questions: hw.questions.map((q) => ({ id: `q${q.number}`, number: q.number, text: q.text, maxMarks: q.maxMarks, rubric: q.rubric, answerKey: q.answerKey, conceptIds: q.conceptIds, misconceptions: [] })),
      });
      expect(res.answers).toHaveLength(hw.questions.length);
      const worst = res.answers.map((ans) => computeConfidence(signalsFor(ans, hw.questions.find((q) => q.number === ans.questionNumber)!.maxMarks)).band).sort((x, y) => ["low", "medium", "high"].indexOf(x) - ["low", "medium", "high"].indexOf(y))[0];
      bands[worst]++;
    }
    expect(bands.high).toBeGreaterThan(bands.medium + bands.low);
    expect(bands.medium + bands.low).toBeGreaterThan(0);
  });

  it("renders a handwritten SVG page with the student's header, escaping text", () => {
    const svg = renderSyntheticPage({
      ref: { assessmentId: "asm_x1", studentId: "stu_8b_05", ability: 0.6 },
      studentName: "A <b>& Co",
      rollNumber: 5,
      sectionName: "8B",
      title: "Homework 3",
      questions,
      page: 0,
      fontDataUrl: null,
    });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("A &lt;b&gt;&amp; Co");
    expect(svg).toContain("Roll: 5");
    expect(svg).toContain("Q1.");
  });

  it("keeps a few students absent in a whole class, never in a small group", () => {
    const absent = studentsOf("sec_8b").filter((s) => syntheticAbsent("asm_x4", s.id, 52)).length;
    expect(absent).toBeLessThan(8);
    expect(syntheticAbsent("asm_x4", "stu_8b_01", 1)).toBe(false);
  });

  it("offers fixture photos for seeded stories, generated sheets in mock mode, none otherwise in live mode", () => {
    expect(sampleKindFor("c8-wt4", "live")).toBe("fixture");
    expect(sampleKindFor("remedial-transposing", "mock")).toBe("fixture");
    expect(sampleKindFor(null, "mock")).toBe("synthetic");
    expect(sampleKindFor("c8-hw3", "mock")).toBe("synthetic");
    expect(sampleKindFor(null, "live")).toBeNull();
  });
});

describe("assessment status as teachers see it", () => {
  it("shows work that is not handed out as Ready to grade with a tag", () => {
    expect(assessmentStatus({ status: "questions_ready", handedOut: false, sheets: 0 })).toEqual({ label: "Ready to grade", variant: "default", tag: "Not handed out" });
    expect(assessmentStatus({ status: "questions_ready", handedOut: true, sheets: 0 }).label).toBe("Awaiting sheets");
    expect(assessmentStatus({ status: "questions_ready", handedOut: true, sheets: 4 }).label).toBe("Matching sheets");
    expect(assessmentStatus({ status: "final" }).variant).toBe("high");
  });

  it("links an assigned remedial straight to where its grading continues", () => {
    expect(assessmentHref({ id: "asm_1", status: "questions_ready" })).toBe("/assessments/asm_1");
    expect(assessmentHref({ id: "asm_1", status: "in_review" })).toBe("/assessments/asm_1/review");
    expect(assessmentHref({ id: "asm_1", status: "final" })).toBe("/assessments/asm_1/results");
    expect(gradeActionLabel("questions_ready")).toBe("Grade responses");
    expect(gradeActionLabel("final")).toBe("Results");
  });
});
