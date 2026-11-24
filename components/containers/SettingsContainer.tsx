"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { api } from "@/lib/client/api";
import type { SettingsData } from "@/lib/queries/settings";

export function SettingsContainer({ data }: { data: SettingsData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsPanel
      data={data}
      busy={busy}
      message={message}
      error={error}
      onReset={async () => {
        setBusy(true);
        setError(null);
        setMessage(null);
        try {
          const r = await api<{ students: number; assessments: number; answers: number; flags: number }>("/api/settings/reset", { method: "POST" });
          setMessage(`Reset: ${r.students} students, ${r.assessments} assessments, ${r.answers} graded answers, ${r.flags} alerts.`);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
      onSignOut={async () => {
        await fetch("/api/session", { method: "DELETE" });
        router.push("/");
      }}
    />
  );
}
