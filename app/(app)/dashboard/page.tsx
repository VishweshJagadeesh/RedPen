import { TeacherHome } from "@/components/home/TeacherHome";
import { getHomeData } from "@/lib/queries/home";
import { requireTeacherId } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const teacherId = await requireTeacherId();
  const [data, teacher] = await Promise.all([getHomeData(teacherId), prisma.teacher.findUnique({ where: { id: teacherId } })]);
  return <TeacherHome data={data} teacherFirstName={teacher?.name.split(" ")[0] ?? "teacher"} />;
}
