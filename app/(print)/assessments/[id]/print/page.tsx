import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentCopy } from "@/components/grading/StudentCopy";
import { PrintButton } from "@/components/shared/PrintButton";
import { BackLink } from "@/components/shared/States";
import { prisma } from "@/lib/db/prisma";
import { getStudentCopy } from "@/lib/queries/assessments";

export const metadata = { title: "Print student copy" };

/** Student copies of any assessment: one blank copy to photocopy, or one per student with the header filled in. */
export default async function PrintStudentCopyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ perStudent?: string }> }) {
  const { id } = await params;
  const { perStudent } = await searchParams;
  const data = await getStudentCopy(id);
  if (!data) notFound();
  const named = perStudent === "1";
  const students = named ? await prisma.student.findMany({ where: { sectionId: data.sectionId }, orderBy: { rollNumber: "asc" } }) : [];
  const copy = { title: data.title, type: data.type, sectionName: data.sectionName, date: data.date, questions: data.questions };
  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4">
        <BackLink href={`/assessments/${data.id}`} label={data.title.length > 40 ? `${data.title.slice(0, 38)}…` : data.title} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/assessments/${data.id}/print`} className={named ? "underline" : "font-semibold"} data-demo-id="print-blank-copy">
            One blank copy
          </Link>
          <Link href={`/assessments/${data.id}/print?perStudent=1`} className={named ? "font-semibold" : "underline"} data-demo-id="print-named-copies">
            One per student, names filled in
          </Link>
          <PrintButton />
        </div>
      </div>
      {data.questions.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-600">Confirm the questions first, then print.</p>
      ) : named ? (
        students.map((s) => <StudentCopy key={s.id} {...copy} student={{ name: s.name, rollNumber: s.rollNumber }} />)
      ) : (
        <StudentCopy {...copy} />
      )}
    </div>
  );
}
