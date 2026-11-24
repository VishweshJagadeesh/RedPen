import { notFound } from "next/navigation";
import { PrintableRemedialSheet } from "@/components/remedial/PrintableRemedialSheet";
import { PrintButton } from "@/components/shared/PrintButton";
import { getRemedial, personalCitations } from "@/lib/remedial/service";

export const metadata = { title: "Print remedial sheets" };

export default async function PrintRemedialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRemedial(id);
  if (!data) notFound();
  const conceptIds = data.concepts.map((c) => c.id);
  const sheets = await Promise.all(data.students.map(async (s) => ({ student: s, citations: await personalCitations(data.section.id, s.id, conceptIds) })));
  return (
    <div>
      <div className="no-print flex items-center justify-between gap-2 p-4">
        <span className="text-sm text-gray-600">{sheets.length} sheet(s), one page per student.</span>
        <PrintButton />
      </div>
      {sheets.map((s) => (
        <PrintableRemedialSheet key={s.student.id} title={data.title} sectionName={data.section.name} student={s.student} citations={s.citations} questions={data.questions} />
      ))}
    </div>
  );
}
