import { KIND_LABEL, type PlanEvidence, type PlanInputs, type PlanSection } from "@/lib/planner/types";

/** A clean print layout: the plan for the teacher, then one exit-ticket half-sheet for students. */
export function PrintablePlan({ sectionName, evidence, inputs, sections }: { sectionName: string; evidence: PlanEvidence; inputs: PlanInputs; sections: PlanSection[] }) {
  const exit = sections.find((s) => s.kind === "exit_ticket");
  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-[13px] leading-relaxed text-black" data-demo-id="printable-plan">
      <div className="print-page">
        <h1 className="text-xl font-bold">
          Reteach plan — {evidence.conceptName} · Class {sectionName}
        </h1>
        <p className="text-gray-600">
          {inputs.periodMinutes} minutes · {inputs.resources} · based on {evidence.assessmentTitle}: {evidence.studentsUnder} of {evidence.studentsAssessed} under 50%, class mastery {Math.round(evidence.meanPct)}%
        </p>
        <ol className="mt-2 list-decimal pl-5 text-gray-700">
          {evidence.misconceptions.map((m) => (
            <li key={m.label}>
              {m.label} — {m.count} students
            </li>
          ))}
        </ol>
        {sections
          .filter((s) => s.kind !== "exit_ticket")
          .map((s) => (
            <section key={s.id} className="mt-4 break-inside-avoid">
              <h2 className="font-semibold">
                {s.title}
                {s.minutes ? ` (${s.minutes} min)` : ""} <span className="font-normal text-gray-500">· {KIND_LABEL[s.kind]}</span>
              </h2>
              {s.body && <p className={s.kind === "board_plan" ? "mt-1 whitespace-pre-wrap border p-2 font-mono" : "whitespace-pre-wrap"}>{s.body}</p>}
              {s.questions.length > 0 && (
                <ol className="list-decimal pl-5">
                  {s.questions.map((q, i) => (
                    <li key={i}>
                      {q.text} <span className="text-gray-500">(Ans: {q.answer.split("\n").slice(-1)[0]})</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.pairs && (
                <ul className="grid grid-cols-2 gap-x-4 pl-1">
                  {s.pairs.groups.map((g, i) => (
                    <li key={i}>
                      {g.mentorName} → {g.learners.map((l) => l.name).join(", ")}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
      </div>
      {exit && (
        <div className="mt-8 border-t-2 border-dashed pt-6">
          <h2 className="text-lg font-bold">Exit ticket — {evidence.conceptName}</h2>
          <p>Name: ______________________ Roll No: ______ Class: {sectionName} Date: ___________</p>
          <ol className="mt-3 list-decimal space-y-10 pl-5 text-base">
            {exit.questions.map((q, i) => (
              <li key={i}>
                {q.text} <span className="text-gray-500">[{q.marks}]</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
