"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WhyFlaggedPanel } from "@/components/diagnosis/WhyFlaggedPanel";
import { api } from "@/lib/client/api";
import type { FlagDetail } from "@/lib/queries/alerts";

export function WhyFlaggedContainer({ flag }: { flag: FlagDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <WhyFlaggedPanel
      flag={flag}
      busy={busy}
      error={error}
      remedialHref={`/remedial/new?flagId=${flag.id}`}
      studentHref={`/sections/${flag.section.id}/students/${flag.student.id}`}
      onSetStatus={async (status, note) => {
        setBusy(true);
        setError(null);
        try {
          await api(`/api/flags/${flag.id}`, { method: "POST", json: { status, note } });
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
