"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { DemoData } from "./data/types";

const Stage = dynamic(() => import("./Stage"), { ssr: false, loading: () => <Loading /> });

function Loading({ error }: { error?: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#14161d", color: "#f4f1ea", fontFamily: "system-ui, sans-serif", fontSize: 18 }} data-demo-id="demo-loading">
      {error ?? "Loading the walkthrough…"}
    </div>
  );
}

/** Loads the data snapshot, then the stage (client only). */
export function DemoClient() {
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/demo/data.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: DemoData) => live && setData(d))
      .catch((e: unknown) => live && setError(`The walkthrough data could not be loaded (${e instanceof Error ? e.message : String(e)}).`));
    return () => {
      live = false;
    };
  }, []);
  if (error) return <Loading error={error} />;
  if (!data) return <Loading />;
  return <Stage data={data} />;
}
