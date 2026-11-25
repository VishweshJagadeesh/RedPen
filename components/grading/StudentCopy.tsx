import { ASSESSMENT_TYPE_LABEL, type AssessmentType } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export interface StudentCopyProps {
  title: string;
  type: string;
  sectionName: string;
  teacherName?: string;
  date: string;
  questions: { number: number; text: string; maxMarks: number }[];
  /** Prefilled header (one copy per student); blank lines otherwise. */
  student?: { name: string; rollNumber: number } | null;
  /** "print": A4 sheet with answer space; "screen": the shared read-only page. */
  variant?: "print" | "screen";
}

/**
 * What students get: the questions with marks and room to answer. Never shows the answer key or rubric.
 * A clear name / roll header helps RedPen match the sheet back to the student when it is photographed.
 */
export function StudentCopy({ title, type, sectionName, teacherName, date, questions, student, variant = "print" }: StudentCopyProps) {
  const total = questions.reduce((s, q) => s + q.maxMarks, 0);
  const print = variant === "print";
  return (
    <div
      className={print ? "print-page mx-auto max-w-[800px] bg-white p-8 text-[15px] text-black" : "mx-auto max-w-2xl rounded-xl border bg-card p-5 text-[15px] sm:p-8"}
      data-demo-id={student ? `student-copy-${student.rollNumber}` : "student-copy"}
    >
      <div className="border-b pb-3">
        <div className="text-xs uppercase tracking-wide text-gray-600">
          Class {sectionName} · {ASSESSMENT_TYPE_LABEL[type as AssessmentType] ?? "Assessment"} · {formatDate(date)}
          {teacherName ? ` · ${teacherName}` : ""}
        </div>
        <div className="mt-1 text-xl font-bold">{title}</div>
        {print && (
          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2">
            <div>
              Name: {student ? <span className="font-semibold">{student.name}</span> : <span className="inline-block w-56 border-b border-black" />}
            </div>
            <div>
              Roll No: {student ? <span className="font-semibold">{student.rollNumber}</span> : <span className="inline-block w-12 border-b border-black" />}
            </div>
            <div>Marks: ____ / {total}</div>
          </div>
        )}
        {!print && (
          <p className="mt-2 text-sm text-gray-600">
            {questions.length} questions · {total} marks. Write your answers on paper with your <b>name and roll number at the top</b>, and hand them in to your teacher.
          </p>
        )}
      </div>
      <ol className={print ? "mt-5 space-y-6" : "mt-5 space-y-4"}>
        {questions.map((q) => (
          <li key={q.number} className="break-inside-avoid">
            <div className="flex gap-2">
              <span className="font-semibold">Q{q.number}.</span>
              <span className="flex-1 whitespace-pre-wrap">{q.text}</span>
              <span className="shrink-0 text-gray-600">[{q.maxMarks}]</span>
            </div>
            {print && <div className="mt-1 border-b border-dashed border-gray-300" style={{ height: `${Math.min(10, Math.max(3, Math.ceil(q.maxMarks * 1.5)))}rem` }} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
