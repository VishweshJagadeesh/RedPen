"use client";
/**
 * Renders a store screen with the app's real presentational components (the same ones the routes use),
 * wrapped in the same page chrome (AppShell, PageHeader) as the corresponding route. Callbacks are inert:
 * the walkthrough drives every state change from its timeline.
 */
import { useMemo } from "react";
import { BellRing, Check, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/States";
import { UploadWizard } from "@/components/grading/UploadWizard";
import { AssessmentDetailsForm } from "@/components/grading/AssessmentDetailsForm";
import { QuestionConfirmTable } from "@/components/grading/QuestionConfirmTable";
import { SheetUploader } from "@/components/grading/SheetUploader";
import { SheetMatcher } from "@/components/grading/SheetMatcher";
import { GradingProgress } from "@/components/grading/GradingProgress";
import { ReviewQueueView } from "@/components/grading/ReviewQueue";
import { ClassConceptHeatmap } from "@/components/diagnosis/ClassConceptHeatmap";
import { WeakConceptCard } from "@/components/diagnosis/WeakConceptCard";
import { FlaggedStudentsList } from "@/components/diagnosis/FlaggedStudentsList";
import { WhyFlaggedPanel } from "@/components/diagnosis/WhyFlaggedPanel";
import { EvidenceSummary } from "@/components/reteach/EvidenceSummary";
import { ReteachInputsForm } from "@/components/reteach/ReteachInputsForm";
import { ReteachPlanEditor } from "@/components/reteach/ReteachPlanEditor";
import { TeachingModeView } from "@/components/reteach/TeachingMode";
import { RemedialBuilder } from "@/components/remedial/RemedialBuilder";
import { PtmSummary } from "@/components/profile/PtmSummary";
import { GenerationProgress } from "@/components/shared/GenerationProgress";
import { ASSESSMENT_TYPE_LABEL } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import type { DemoData } from "../data/types";
import type { Screen } from "./store";

const noop = () => {};

function Shell({ data, children, openFlags = 3, weak8b }: { data: DemoData; children: React.ReactNode; openFlags?: number; weak8b: number }) {
  const sections = data.teacher.sections.map((name) => ({ id: `sec_${name.toLowerCase()}`, name, weakConcepts: name === data.section.name ? weak8b : 0 }));
  return (
    <AppShell teacherName={data.teacher.name} subject={data.teacher.subject} mode="mock" sections={sections} openFlags={openFlags}>
      {children}
    </AppShell>
  );
}

function LockScreen({ s }: { s: Extract<Screen, { kind: "lock" }> }) {
  return (
    <div className="demo-lock" data-demo-id="lock-screen">
      <div className="demo-lock-time">{s.time}</div>
      <div className="demo-lock-date">{s.date}</div>
      <div className="demo-lock-icon">
        <Lock aria-hidden />
      </div>
      {s.notification && (
        <div className="demo-notif" data-demo-id="lock-notification">
          <div className="demo-notif-head">
            <span className="demo-notif-app">
              <BellRing aria-hidden />
            </span>
            <b>Kaksha</b>
            <span className="demo-notif-when">now</span>
          </div>
          <div className="demo-notif-title">Weekly Test 4 · 8B</div>
          <div className="demo-notif-body">52 sheets to grade</div>
        </div>
      )}
    </div>
  );
}

function Outro({ s }: { s: Extract<Screen, { kind: "outro" }> }) {
  const nodes: [string, number, number][] = [
    ["Grade", 210, 70],
    ["Diagnose", 350, 210],
    ["Act", 210, 350],
    ["Track", 70, 210],
  ];
  return (
    <div className="demo-outro" data-demo-id="outro">
      <div className="demo-outro-brand">
        <span className="demo-outro-logo">R</span>RedPen
      </div>
      <svg className="demo-outro-loop" viewBox="0 0 420 420" aria-label="Grade, Diagnose, Act, Track">
        <circle className="demo-outro-ring" cx="210" cy="210" r="140" />
        {nodes.map(([n, x, y], i) => (
          <g key={n} className={`demo-outro-node${i === s.lit ? " on" : ""}`}>
            <circle cx={x} cy={y} r="58" />
            <text x={x} y={y + 7} textAnchor="middle">
              {n}
            </text>
          </g>
        ))}
        {[-45, 45, 135, 225].map((d) => {
          const a = (d * Math.PI) / 180;
          const cx = 210 + 140 * Math.cos(a);
          const cy = 210 + 140 * Math.sin(a);
          const tx = -Math.sin(a);
          const ty = Math.cos(a);
          const nx = Math.cos(a);
          const ny = Math.sin(a);
          const P = (u: number, v: number) => `${(cx + tx * u + nx * v).toFixed(1)},${(cy + ty * u + ny * v).toFixed(1)}`;
          return <polygon key={d} points={`${P(11, 0)} ${P(-7, 9)} ${P(-7, -9)}`} className="demo-outro-arrow" />;
        })}
      </svg>
      <div className={`demo-outro-line${s.line ? " on" : ""}`} data-demo-id="outro-line">
        Grading already is the data entry. Everything else follows.
      </div>
    </div>
  );
}

function fakeFiles(n: number, name: string, bytes: number): File[] {
  return Array.from({ length: n }, () => new File([new Uint8Array(bytes)], name, { type: "image/jpeg" }));
}

export function ScreenView({ data, screen }: { data: DemoData; screen: Screen }) {
  const g = data.grade;
  const r = data.reteach;
  const m = data.remediate;
  const sectionName = data.section.name;
  const asmEyebrow = `Class ${sectionName} · ${ASSESSMENT_TYPE_LABEL.weekly_test} · ${formatDate(g.date)}`;
  const paperCount = screen.kind === "wizard-details" ? screen.values.paper : 0;
  const keyCount = screen.kind === "wizard-details" ? screen.values.key : 0;
  const paperFiles = useMemo(() => fakeFiles(paperCount, "WT4 question paper.jpg", g.paperImage.bytes), [paperCount, g.paperImage.bytes]);
  const keyFiles = useMemo(() => fakeFiles(keyCount, "WT4 answer key.jpg", g.keyImage.bytes), [keyCount, g.keyImage.bytes]);
  const weak8b = r.weakConceptIds.length;

  switch (screen.kind) {
    case "lock":
      return <LockScreen s={screen} />;
    case "outro":
      return <Outro s={screen} />;
    case "wizard-details":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader title="New assessment" back={{ href: "/assessments", label: "Assessments" }} />
          <UploadWizard step="details" heading="Question paper and answer key" description="Photograph the paper and the key; the AI reads the questions and marks.">
            <AssessmentDetailsForm
              sections={data.teacher.sections.map((name) => ({ id: `sec_${name.toLowerCase()}`, name }))}
              samples={[]}
              defaultDate={g.date}
              busy={screen.busy}
              error={null}
              onSubmit={noop}
              values={{ ...screen.values, paper: paperFiles, key: keyFiles }}
              onValuesChange={noop}
            />
          </UploadWizard>
        </Shell>
      );
    case "wizard-questions":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={asmEyebrow} title={g.title} back={{ href: "/assessments", label: "Assessments" }} />
          <UploadWizard step="questions" heading="Check the questions" description="The AI split the paper into questions with step marks and concept tags. Edit anything before grading.">
            <QuestionConfirmTable questions={g.questions} concepts={g.concepts} warnings={[]} confirmed={false} busy={false} error={null} onSave={noop} />
          </UploadWizard>
        </Shell>
      );
    case "wizard-sheets":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={screen.eyebrow ?? asmEyebrow} title={screen.title} back={{ href: "/assessments", label: screen.back ?? "Assessments" }} />
          <UploadWizard step="sheets" heading="Upload the answer sheets">
            <SheetUploader uploaded={{ sheets: screen.sheets, pages: screen.pages }} progress={screen.progress} sampleKind={screen.sampleKind} busy={!!screen.progress && screen.progress.done < screen.progress.total} error={null} onFiles={noop} onUseSamples={noop} />
          </UploadWizard>
        </Shell>
      );
    case "wizard-match": {
      const matched = new Set(screen.sheets.map((s) => s.studentId).filter(Boolean));
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={asmEyebrow} title={screen.title} back={{ href: "/assessments", label: "Assessments" }} />
          <UploadWizard step="match" heading="Match sheets to students" description="Names and roll numbers were read from page 1 of each sheet. Check the highlighted rows, then start grading.">
            <SheetMatcher
              sheets={screen.sheets}
              roster={g.roster}
              missingStudents={g.roster.filter((s) => !matched.has(s.id))}
              busy={false}
              error={null}
              confirmLabel={screen.ready ? "Start grading" : "Confirm matches"}
              onChange={noop}
              onRemove={noop}
              onConfirm={noop}
            />
          </UploadWizard>
        </Shell>
      );
    }
    case "grading":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={screen.eyebrow} title={screen.title} back={{ href: "/assessments", label: screen.title }} description="Grading runs answer by answer. You review everything before it becomes final." />
          <GradingProgress progress={screen.progress} running={screen.running} error={null} reviewHref="#" mode="mock" onStart={noop} onPause={noop} onRetry={noop} />
        </Shell>
      );
    case "review": {
      const pendingHigh = screen.items.filter((i) => i.status === "pending_review" && !i.needsRescan && i.band === "high").length;
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={screen.eyebrow} title={`Review: ${screen.title}`} back={{ href: "/assessments", label: screen.title }} description="Least certain answers first. Nothing is final until you accept it." />
          <ReviewQueueView
            items={screen.items}
            pendingHigh={pendingHigh}
            ungradedSheets={0}
            isFinal={screen.isFinal}
            busy={false}
            error={null}
            finaliseNotes={screen.finaliseNotes}
            resultsHref="#"
            onAccept={noop}
            onOverride={noop}
            onIllegible={noop}
            onNeedsRescan={noop}
            onUploadRescan={noop}
            onAcceptAllHigh={noop}
            onFinalise={noop}
            ui={screen.ui}
            onUiChange={noop}
          />
        </Shell>
      );
    }
    case "heatmap":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={`${data.teacher.subject} · ${data.section.students.length} students`} title={`Class ${sectionName}`} back={{ href: "/dashboard", label: "Home" }} />
          <ClassConceptHeatmap data={r.heatmap} studentHrefBase={`/sections/${data.section.id}/students`} weakConceptIds={r.weakConceptIds} highlightConceptId={r.conceptId} />
        </Shell>
      );
    case "weak-card":
      return (
        <Shell data={data} weak8b={screen.card.isWeak ? weak8b : weak8b - 1}>
          <PageHeader eyebrow={`${data.teacher.subject} · ${data.section.students.length} students`} title={`Class ${sectionName}`} back={{ href: "/dashboard", label: "Home" }} />
          <WeakConceptCard concept={screen.card} planHref="#" practiceHref="#" />
        </Shell>
      );
    case "reteach-setup":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={`Class ${sectionName} · ${r.evidence.chapter}`} title={`Plan a reteach: ${r.evidence.conceptName}`} back={{ href: "#", label: `Class ${sectionName}` }} description="One period, built around the mistakes this class actually made." />
          <div className="space-y-4">
            <EvidenceSummary evidence={r.evidence} />
            {screen.steps && (
              <GenerationProgress
                title="Building your reteach plan"
                steps={screen.steps}
                percent={screen.percent}
                elapsedSeconds={screen.elapsed}
                hint="You can keep this tab open; the draft opens as soon as it is saved. Nothing is shown to students until you print or teach it."
                demoId="plan-progress"
              />
            )}
            <ReteachInputsForm defaultPeriod={r.defaultPeriod} busy={!!screen.steps} error={null} onSubmit={noop} values={screen.values} onValuesChange={noop} />
          </div>
        </Shell>
      );
    case "plan":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={`Class ${sectionName} · ${r.evidence.chapter}`} title={`Reteach: ${r.evidence.conceptName}`} back={{ href: "#", label: `Class ${sectionName}` }} />
          <ReteachPlanEditor
            evidence={r.evidence}
            inputs={r.inputs}
            sections={screen.sections.slice(0, screen.shown)}
            status={screen.status}
            taughtAt={null}
            exitTicket={null}
            students={data.section.students}
            dirty={screen.dirty}
            busy={null}
            error={null}
            teachHref="#"
            printHref="#"
            onChange={noop}
            onSave={noop}
            onRegenerate={noop}
            onReshufflePairs={noop}
            onStatus={noop}
            onCreateExitTicket={noop}
            editingId={screen.editingId}
            onEditingChange={noop}
            taughtDate={r.taughtDate}
            onTaughtDateChange={noop}
          />
        </Shell>
      );
    case "teach":
      return <TeachingModeView conceptName={r.evidence.conceptName} steps={r.teachingSteps} boardPlan={r.boardPlan} exitHref="#" ui={screen.ui} onUiChange={noop} />;
    case "flags":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader title="Needs attention" description="Every alert says why it fired. Open one to see the evidence and act on it." />
          <FlaggedStudentsList flags={m.flags} />
        </Shell>
      );
    case "why":
      return (
        <Shell data={data} weak8b={weak8b}>
          <PageHeader eyebrow={`Class ${screen.flag.section.name} · Roll ${screen.flag.student.rollNumber}`} title={`Why ${screen.flag.student.name} was flagged`} back={{ href: "/alerts", label: "Alerts" }} />
          <WhyFlaggedPanel flag={screen.flag} remedialHref="#" studentHref="#" busy={false} error={null} onSetStatus={noop} />
        </Shell>
      );
    case "remedial":
      return (
        <Shell data={data} weak8b={weak8b}>
          {screen.phase === "setup" ? (
            <PageHeader eyebrow={`Class ${sectionName}`} title="New remedial sheet" back={{ href: "/alerts", label: "the alert" }} description="Prefilled from the evidence. Change anything before generating." />
          ) : (
            <PageHeader eyebrow={`Class ${sectionName}`} title={m.builder.title} back={{ href: "/remedial", label: "Remedial sheets" }} description={screen.status === "draft" ? "Review, edit or remove questions, then assign. Nothing goes out until you assign it." : undefined} />
          )}
          <RemedialBuilder
            phase={screen.phase}
            title={m.builder.title}
            roster={m.builder.roster}
            concepts={m.builder.concepts}
            setup={screen.setup}
            fromFlag
            questions={screen.questions}
            status={screen.status}
            dirty={screen.dirty}
            busy={screen.busy}
            error={null}
            printHref={screen.phase === "review" ? "#" : undefined}
            assessmentHref={screen.status !== "draft" ? "#" : null}
            assessmentStatus={screen.status === "assigned" ? "questions_ready" : null}
            onSetupChange={noop}
            onGenerate={noop}
            onQuestionsChange={noop}
            onSave={noop}
            onAssign={noop}
          />
        </Shell>
      );
    case "ptm":
      return (
        <div className="min-h-screen bg-white">
          <PtmSummary student={data.ptm.student} teacherName={data.teacher.name} trend={data.ptm.trend} summary={data.ptm.summary} sources={data.ptm.sources} backHref="#" lang={screen.lang} onLangChange={noop} />
        </div>
      );
  }
}

/** Small icons used by the panel chrome. */
export const PanelIcons = { Check, Lock };
