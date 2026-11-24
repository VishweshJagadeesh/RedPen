"use client";
import { useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { SettingsData } from "@/lib/queries/settings";

export interface SettingsPanelProps {
  data: SettingsData;
  busy: boolean;
  message: string | null;
  error: string | null;
  onReset: () => void;
  onSignOut: () => void;
}

export function SettingsPanel({ data, busy, message, error, onReset, onSignOut }: SettingsPanelProps) {
  const [confirm, setConfirm] = useState(false);
  const d = data.thresholds.diagnosis;
  const c = data.thresholds.confidence;
  const rows: [string, string][] = [
    ["Confidence: High band", `≥ ${c.high}`],
    ["Confidence: Medium band", `≥ ${c.medium} (below is Low)`],
    ["Answers with instructions to the grader", `capped at ${c.injectionCap} (Low)`],
    ["Class-wide weak concept", `≥ ${Math.round(d.classWeakShare * 100)}% of students under ${d.weakScore}%`],
    ["Sudden drop", `≥ ${d.suddenDropPoints} points below own average of previous ${d.suddenDropWindow}, or above median → below 25th percentile`],
    ["Missed submissions", `${d.missedCount}+ missing in the last ${d.missedWindow}`],
    ["Concept regression", `mastery falls by ≥ ${d.regressionPoints} points`],
    ["Minimum evidence for a concept signal", `${d.minConceptMarks} marks`],
    ["Alert moves to Improving", `follow-up work ≥ ${d.improvingScore}% on the target concepts`],
    ["Alert resolves", `a later test within ${d.resolveWithin} points of the baseline`],
  ];
  return (
    <div className="space-y-6" data-demo-id="settings-panel">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demo data</CardTitle>
            <CardDescription>Restore the seeded term: 3 classes, 152 students, July–October tests, 8B Weekly Test 4 waiting to be graded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {message && <Alert tone="success">{message}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={busy} onClick={() => setConfirm(true)} data-demo-id="reset-demo-data">
                <RotateCcw /> {busy ? "Resetting…" : "Reset demo data"}
              </Button>
              <Button variant="outline" onClick={onSignOut} data-demo-id="sign-out">
                <LogOut /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              Mode: <Badge variant={data.mode === "live" ? "high" : "medium"} data-demo-id="settings-ai-mode">{data.mode === "live" ? "Live (Anthropic API)" : "Mock (sample fixtures)"}</Badge>
            </div>
            <div>Grading model: <code>{data.models.grading}</code></div>
            <div>Planning model: <code>{data.models.planning}</code></div>
            <div>API key: {data.hasKey ? "set" : "not set"} · Storage: {data.storage} · Database: {data.database}</div>
            <p className="pt-2 text-muted-foreground">Set AI_MODE=live|mock. It defaults to live when ANTHROPIC_API_KEY is set. Thresholds come from lib/config.ts and env overrides.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TBody>
              {rows.map(([k, v]) => (
                <TR key={k}>
                  <TD className="font-medium">{k}</TD>
                  <TD className="text-muted-foreground">{v}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            Every override and every AI action is logged ({data.counts.overrides} overrides, {data.counts.aiActions} AI actions). Latest 60 shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-demo-id="audit-log">
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Who</TH>
                <TH>Action</TH>
                <TH>On</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <TBody>
              {data.audit.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap text-xs">{a.createdAt.slice(0, 16).replace("T", " ")}</TD>
                  <TD>
                    <Badge variant={a.actor === "ai" ? "ai" : a.actor === "teacher" ? "secondary" : "outline"}>{a.actor}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{a.action}</TD>
                  <TD className="font-mono text-xs">{a.entityType}</TD>
                  <TD className="max-w-md truncate font-mono text-[11px] text-muted-foreground" title={a.details}>
                    {a.details}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all demo data?</DialogTitle>
            <DialogDescription>Everything you graded, planned or assigned in this demo will be replaced by the original seeded state.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-demo-id="confirm-reset"
              onClick={() => {
                setConfirm(false);
                onReset();
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
