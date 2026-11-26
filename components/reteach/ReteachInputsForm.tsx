"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import type { PlanInputs } from "@/lib/planner/types";

export interface ReteachInputsFormProps {
  defaultPeriod: number;
  busy: boolean;
  error: string | null;
  onSubmit: (inputs: PlanInputs) => void;
  /** Optional controlled values (otherwise the form keeps its own). */
  values?: PlanInputs;
  onValuesChange?: (inputs: PlanInputs) => void;
}

export function ReteachInputsForm({ defaultPeriod, busy, error, onSubmit, values, onValuesChange }: ReteachInputsFormProps) {
  const [own, setOwn] = useState<PlanInputs>({ periodMinutes: defaultPeriod, resources: "blackboard", language: "en", note: "" });
  const inputs = values ?? own;
  const setInputs = (next: PlanInputs) => (onValuesChange ? onValuesChange(next) : setOwn(next));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(inputs);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="period">Period length (minutes)</Label>
          <Input id="period" type="number" min={20} max={90} value={inputs.periodMinutes} onChange={(e) => setInputs({ ...inputs, periodMinutes: Number(e.target.value) })} data-demo-id="reteach-period" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resources">Resources</Label>
          <NativeSelect id="resources" value={inputs.resources} onChange={(e) => setInputs({ ...inputs, resources: e.target.value as PlanInputs["resources"] })} data-demo-id="reteach-resources">
            <option value="blackboard">Blackboard only</option>
            <option value="projector">Projector</option>
            <option value="worksheets">Worksheets</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Language of instruction</Label>
          <NativeSelect id="language" value={inputs.language} onChange={(e) => setInputs({ ...inputs, language: e.target.value as PlanInputs["language"] })} data-demo-id="reteach-language">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="mixed">Mixed (Hindi + English)</option>
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" placeholder="e.g. Period after lunch; keep it hands-on." value={inputs.note} onChange={(e) => setInputs({ ...inputs, note: e.target.value })} data-demo-id="reteach-note" />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={busy || inputs.periodMinutes < 20} data-demo-id="generate-plan">
        <Sparkles /> {busy ? "Planning from your class's mistakes…" : "Generate reteach plan"}
      </Button>
    </form>
  );
}
