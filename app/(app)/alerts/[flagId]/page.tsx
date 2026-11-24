import { notFound } from "next/navigation";
import { WhyFlaggedContainer } from "@/components/containers/WhyFlaggedContainer";
import { PageHeader } from "@/components/shared/States";
import { getFlag } from "@/lib/queries/alerts";

export const metadata = { title: "Why flagged" };

export default async function AlertPage({ params }: { params: Promise<{ flagId: string }> }) {
  const { flagId } = await params;
  const flag = await getFlag(flagId);
  if (!flag) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={`Class ${flag.section.name} · Roll ${flag.student.rollNumber}`} title={`Why ${flag.student.name} was flagged`} />
      <WhyFlaggedContainer flag={flag} />
    </div>
  );
}
