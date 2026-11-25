import type { BackTarget } from "@/components/shared/States";

const short = (title: string) => (title.length > 42 ? `${title.slice(0, 40).trimEnd()}…` : title);

/** Where an assessment "came from": its remedial sheet, its reteach plan, its class (homework) or the Assessments list. */
export function assessmentParent(a: { remedialAssignmentId: string | null; lessonPlanId: string | null; type: string; section: { id: string; name: string } }): BackTarget {
  if (a.remedialAssignmentId) return { href: `/remedial/${a.remedialAssignmentId}`, label: "the remedial sheet" };
  if (a.lessonPlanId) return { href: `/reteach/${a.lessonPlanId}`, label: "the reteach plan" };
  if (a.type === "homework") return { href: `/sections/${a.section.id}`, label: `Class ${a.section.name}` };
  return { href: "/assessments", label: "Assessments" };
}

/** Grading, review and results pages go back to the assessment's own page. */
export function assessmentHome(id: string, title: string): BackTarget {
  return { href: `/assessments/${id}`, label: short(title) };
}
