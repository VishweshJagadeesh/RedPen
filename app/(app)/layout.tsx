import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getShellData } from "@/lib/queries/shell";
import { currentTeacherId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const teacherId = await currentTeacherId();
  if (!teacherId) redirect("/");
  const shell = await getShellData(teacherId);
  if (!shell) redirect("/?reset=1");
  return (
    <AppShell teacherName={shell.teacherName} subject={shell.subject} mode={shell.mode} sections={shell.sections} openFlags={shell.openFlags}>
      {children}
    </AppShell>
  );
}
