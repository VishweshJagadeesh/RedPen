import { redirect } from "next/navigation";
import { currentTeacherId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentTeacherId())) redirect("/");
  return <div className="min-h-screen bg-white">{children}</div>;
}
