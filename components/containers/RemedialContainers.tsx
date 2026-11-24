"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RemedialBuilder, type RemedialBuilderProps, type RemedialSetup } from "@/components/remedial/RemedialBuilder";
import { api } from "@/lib/client/api";
import type { RemedialData, RemedialQuestion } from "@/lib/remedial/service";

type Shared = Pick<RemedialBuilderProps, "roster" | "concepts" | "fromFlag">;

export function RemedialNewContainer({ initial, sectionId, flagId, ...shared }: Shared & { initial: RemedialSetup; sectionId: string; flagId: string | null }) {
  const router = useRouter();
  const [setup, setSetup] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <RemedialBuilder
      {...shared}
      phase="setup"
      setup={setup}
      questions={[]}
      dirty={false}
      busy={busy}
      error={error}
      onSetupChange={setSetup}
      onGenerate={async () => {
        setBusy("generate");
        setError(null);
        try {
          const { ids } = await api<{ ids: string[] }>("/api/remedial", { method: "POST", json: { ...setup, sectionId, flagId } });
          router.push(ids.length === 1 ? `/remedial/${ids[0]}` : `/remedial`);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setBusy(null);
        }
      }}
      onQuestionsChange={() => {}}
      onSave={() => {}}
      onAssign={() => {}}
    />
  );
}

export function RemedialReviewContainer({ data, ...shared }: Shared & { data: RemedialData }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<RemedialQuestion[]>(data.questions);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setQuestions(data.questions);
    setDirty(false);
  }, [data.questions]);
  async function run(tag: string, fn: () => Promise<unknown>) {
    setBusy(tag);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <RemedialBuilder
      {...shared}
      phase="review"
      title={data.title}
      setup={{ studentIds: data.students.map((s) => s.id), conceptIds: data.concepts.map((c) => c.id), count: data.questions.length, mode: "group" }}
      questions={questions}
      status={data.status}
      dirty={dirty}
      busy={busy}
      error={error}
      printHref={`/remedial/${data.id}/print`}
      assessmentHref={data.assessment ? (data.assessment.status === "final" ? `/assessments/${data.assessment.id}/results` : `/assessments/${data.assessment.id}`) : null}
      onSetupChange={() => {}}
      onGenerate={() => {}}
      onQuestionsChange={(q) => {
        setQuestions(q);
        setDirty(true);
      }}
      onSave={() => run("save", () => api(`/api/remedial/${data.id}`, { method: "PATCH", json: { questions } }))}
      onAssign={() => run("assign", () => api(`/api/remedial/${data.id}/assign`, { method: "POST" }))}
    />
  );
}
