import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentCopy } from "@/components/grading/StudentCopy";
import { getSharedStudentCopy } from "@/lib/queries/assessments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questions", robots: { index: false, follow: false } };

/** Public, read-only student copy behind an unguessable token: questions and marks only. */
export default async function SharedWorkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(token)) notFound();
  const data = await getSharedStudentCopy(token);
  if (!data || data.questions.length === 0) notFound();
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <StudentCopy variant="screen" title={data.title} type={data.type} sectionName={data.sectionName} teacherName={data.teacherName} date={data.date} questions={data.questions} />
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted-foreground">Shared by your teacher with RedPen. Read-only.</p>
    </main>
  );
}
