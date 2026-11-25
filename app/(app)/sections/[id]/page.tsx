import { notFound } from "next/navigation";
import { ClassDashboard } from "@/components/diagnosis/ClassDashboard";
import { PageHeader } from "@/components/shared/States";
import { formatPct } from "@/lib/format";
import { getSectionDashboard } from "@/lib/queries/section";

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSectionDashboard(id);
  if (!data) notFound();
  const latest = data.trend.at(-1);
  return (
    <div>
      <PageHeader
        eyebrow={`Mathematics · ${data.section.academicYear}`}
        title={`Class ${data.section.name}`}
        back={{ href: "/dashboard", label: "Home" }}
        description={`${data.studentCount} students${latest ? ` · latest test average ${formatPct(latest.average)} (${latest.title})` : ""}`}
      />
      <ClassDashboard data={data} />
    </div>
  );
}
