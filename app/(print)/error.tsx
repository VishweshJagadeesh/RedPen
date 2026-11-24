"use client";
import { ErrorState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";

export default function PrintError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="This page could not load" description={error.message} action={<Button variant="outline" onClick={reset}>Try again</Button>} />;
}
