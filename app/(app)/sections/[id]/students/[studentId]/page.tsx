import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { StudentDetail } from "@/components/diagnosis/StudentDetail";
import { PageHeader } from "@/components/shared/States";
import { getStudentView } from "@/lib/queries/student";

export default async function StudentPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const { studentId } = await params;
  const data = await getStudentView(studentId);
  if (!data) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <div>
      <PageHeader eyebrow={`Class ${data.student.section} · Roll ${data.student.rollNumber}`} title={data.student.name} />
      <StudentDetail data={data} shareUrl={`${origin}/p/${data.student.shareToken}`} />
    </div>
  );
}
