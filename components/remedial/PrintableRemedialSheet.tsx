import type { RemedialQuestion } from "@/lib/remedial/service";

/** One printed sheet per student — most students will not have a device. */
export function PrintableRemedialSheet({
  title,
  sectionName,
  student,
  citations,
  questions,
}: {
  title: string;
  sectionName: string;
  student: { name: string; rollNumber: number };
  citations: string[];
  questions: RemedialQuestion[];
}) {
  const total = questions.reduce((s, q) => s + q.marks, 0);
  return (
    <div className="print-page mx-auto max-w-[800px] bg-white p-8 text-[14px] text-black" data-demo-id={`printable-sheet-${student.rollNumber}`}>
      <div className="flex justify-between border-b pb-2">
        <div>
          <div className="text-lg font-bold">{title.replace(/ — [^—]+$/, "")}</div>
          <div>
            Name: <span className="font-semibold">{student.name}</span> · Roll No: {student.rollNumber} · Class {sectionName}
          </div>
        </div>
        <div className="text-right">
          Date: ___________
          <div>Marks: ____ / {total}</div>
        </div>
      </div>
      {citations.length > 0 && (
        <div className="mt-3 rounded border border-gray-400 p-2 text-[13px]">
          <div className="font-semibold">Why this sheet</div>
          <ul className="list-disc pl-5">
            {citations.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <ol className="mt-4 space-y-8">
        {questions.map((q, i) => (
          <li key={q.id} className="break-inside-avoid">
            <div className="flex gap-2">
              <span className="font-semibold">Q{i + 1}.</span>
              <span className="flex-1">{q.text}</span>
              <span>[{q.marks}]</span>
            </div>
            <div className="mt-1 h-16 border-b border-dashed border-gray-300" />
          </li>
        ))}
      </ol>
    </div>
  );
}
