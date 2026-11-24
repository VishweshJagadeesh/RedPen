"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReteachInputsForm } from "@/components/reteach/ReteachInputsForm";
import { api } from "@/lib/client/api";

export function ReteachSetupContainer({ sectionId, conceptId, defaultPeriod }: { sectionId: string; conceptId: string; defaultPeriod: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ReteachInputsForm
      defaultPeriod={defaultPeriod}
      busy={busy}
      error={error}
      onSubmit={async (inputs) => {
        setBusy(true);
        setError(null);
        try {
          const { id } = await api<{ id: string }>("/api/reteach", { method: "POST", json: { sectionId, conceptId, inputs } });
          router.push(`/reteach/${id}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setBusy(false);
        }
      }}
    />
  );
}
