import Link from "next/link";
import { FlaggedStudentsList } from "@/components/diagnosis/FlaggedStudentsList";
import { PageHeader } from "@/components/shared/States";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listFlags } from "@/lib/queries/alerts";
import { requireTeacherId } from "@/lib/session";
import { config } from "@/lib/config";

export const metadata = { title: "Needs attention" };

export default async function AlertsPage() {
  const flags = await listFlags(await requireTeacherId());
  const active = flags.filter((f) => f.status !== "resolved");
  const resolved = flags.filter((f) => f.status === "resolved");
  const d = config.diagnosis;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Needs attention"
        description={
          <>
            Sudden drop: ≥{d.suddenDropPoints} points below the student&apos;s own average of the previous {d.suddenDropWindow}, or from above the class median to below the 25th
            percentile. Missed submissions: {d.missedCount}+ missing in the last {d.missedWindow}. Concept regression: a concept falls by ≥{d.regressionPoints} points.{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Thresholds
            </Link>
          </>
        }
      />
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" data-demo-id="alerts-tab-active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="resolved" data-demo-id="alerts-tab-resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <FlaggedStudentsList flags={active} />
        </TabsContent>
        <TabsContent value="resolved">
          <FlaggedStudentsList flags={resolved} emptyText="No resolved alerts yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
