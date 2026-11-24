import Link from "next/link";
import { notFound } from "next/navigation";
import { RemedialReviewContainer } from "@/components/containers/RemedialContainers";
import { PageHeader } from "@/components/shared/States";
import { builderContext } from "@/lib/queries/remedial";
import { getRemedial } from "@/lib/remedial/service";

export default async function RemedialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRemedial(id);
  if (!data) notFound();
  const ctx = await builderContext(data.section.id, data.concepts[0]?.id);
  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/sections/${data.section.id}`} className="hover:underline">
            Class {data.section.name}
          </Link>
        }
        title={data.title}
        description={data.status === "draft" ? "Review, edit or remove questions, then assign. Nothing goes out until you assign it." : undefined}
      />
      <RemedialReviewContainer data={data} roster={ctx.roster} concepts={ctx.concepts} fromFlag={!!data.flagId} />
    </div>
  );
}
