import { describe, expect, it } from "vitest";
import { buildFixtures, toDataset } from "@/lib/fixtures/history";
import { DatasetIndex } from "@/lib/diagnosis/dataset";
import { classConceptSummary, suggestPeerPairs } from "@/lib/diagnosis/mastery";
import { mockPlanSections, mockRegenerateSection, allocateMinutes } from "@/lib/planner/mock";
import { checkPlan } from "@/lib/planner/live";
import { STUDENTS } from "@/lib/fixtures/school";
import type { PlanEvidence, PlanInputs } from "@/lib/planner/types";

const fx = buildFixtures();
const ds = toDataset("sec_8b", fx.assessments.filter((a) => a.graded));
const s = classConceptSummary(new DatasetIndex(ds), "c8-le-transposing")!;
const evidence: PlanEvidence = {
  conceptId: s.conceptId,
  conceptName: s.conceptName,
  chapter: s.chapter,
  assessmentId: s.assessmentId,
  assessmentTitle: s.assessmentTitle,
  studentsAssessed: s.studentsAssessed,
  studentsUnder: s.studentsUnder,
  meanPct: s.meanPct,
  misconceptions: s.misconceptions,
  snippets: s.snippets.map((x) => ({ text: x.text, misconception: x.misconception, source: `${x.assessmentTitle}, Q${x.questionNumber}` })),
  mentors: 13,
  learners: s.studentsUnder,
  sourceQuestions: [],
};
const inputs: PlanInputs = { periodMinutes: 40, resources: "blackboard", language: "en", note: "" };

describe("mock reteach plan", () => {
  it("passes the evidence checks: cites both misconceptions, fits the period, 2 prerequisite and 3–5 exit questions", () => {
    const plan = mockPlanSections(evidence, inputs);
    expect(checkPlan(plan, evidence, inputs)).toEqual([]);
    const kinds = plan.map((p) => p.kind);
    expect(kinds.slice(0, 8)).toEqual(["objective", "prerequisite_check", "hook", "explanation", "worked_example", "misconception", "guided_practice", "exit_ticket_step"]);
    expect(kinds).toContain("board_plan");
    expect(kinds).toContain("peer_pairs");
    expect(kinds).toContain("extension");
  });

  it("quotes only real snippets and never names a student", () => {
    const text = mockPlanSections(evidence, inputs).map((p) => p.body).join("\n");
    expect(text).toMatch(/21 students/);
    expect(text).toMatch(/Periodic Test 1, Q7/);
    for (const st of STUDENTS) expect(text).not.toContain(st.name);
  });

  it("scales minutes to the period and supports Hindi", () => {
    for (const period of [30, 40, 45, 60]) {
      const m = allocateMinutes(period);
      expect(Object.values(m).reduce((a, b) => a + (b ?? 0), 0)).toBe(period);
      expect(checkPlan(mockPlanSections(evidence, { ...inputs, periodMinutes: period }), evidence, { ...inputs, periodMinutes: period })).toEqual([]);
    }
    const hi = mockPlanSections(evidence, { ...inputs, language: "hi" });
    expect(hi.find((p) => p.kind === "explanation")!.body).toMatch(/विद्यार्थियों/);
  });

  it("regenerating a section changes only that section's content and keeps its citations", () => {
    const plan = mockPlanSections(evidence, inputs).map((p, i) => ({ ...p, id: String(i) }));
    const worked = plan.find((p) => p.kind === "worked_example")!;
    const next = mockRegenerateSection(evidence, inputs, worked);
    expect(next.body).not.toEqual(worked.body);
    expect(next.citesMisconceptions).toEqual(worked.citesMisconceptions);
    expect(next.minutes).toBe(worked.minutes);
  });

  it("pairs mentors (≥60%) with students under 50%", () => {
    const pairs = suggestPeerPairs(s, ds.students);
    expect(pairs.groups.every((g) => g.mentorPct >= 60)).toBe(true);
    expect(pairs.groups.flatMap((g) => g.learners).every((l) => l.pct < 50)).toBe(true);
    expect(pairs.groups.flatMap((g) => g.learners).length + pairs.unpaired.length).toBe(33);
  });
});
