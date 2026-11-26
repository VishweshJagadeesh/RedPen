"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Languages, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { TrendLineChart, type TrendPoint } from "@/components/charts/TrendLineChart";
import type { PtmStatement, PtmSummaryData } from "@/lib/ptm/summary";

export interface PtmSummaryProps {
  student: { name: string; firstName: string; section: string; rollNumber: number };
  teacherName: string;
  trend: TrendPoint[];
  summary: PtmSummaryData;
  /** factId → link to its source (assessment / question). */
  sources: Record<string, { label: string; href: string | null }>;
  backHref: string;
  initialLang?: "en" | "hi";
  /** Optional controlled language (otherwise the toggle keeps its own). */
  lang?: "en" | "hi";
  onLangChange?: (lang: "en" | "hi") => void;
}

const L = {
  en: { title: "Parent–teacher meeting", trend: "Scores this term", strengths: "Doing well", focus: "To work on", term: "This term", talk: "Let's talk about", you: "You", cls: "Class average", lang: "हिंदी" },
  hi: { title: "अभिभावक–शिक्षक बैठक", trend: "इस सत्र के अंक", strengths: "अच्छा कर रहे हैं", focus: "सुधार की ज़रूरत", term: "इस सत्र में", talk: "बातचीत के बिंदु", you: "आप", cls: "कक्षा औसत", lang: "English" },
};

/** PTM mode: one large-text screen to turn toward the parent. Every statement links to its source. */
export function PtmSummary({ student, teacherName, trend, summary, sources, backHref, initialLang = "en", lang: langProp, onLangChange }: PtmSummaryProps) {
  const [ownLang, setOwnLang] = useState<"en" | "hi">(initialLang);
  const lang = langProp ?? ownLang;
  const setLang = (l: "en" | "hi") => (onLangChange ? onLangChange(l) : setOwnLang(l));
  const t = L[lang];
  const Statement = ({ s, demoId }: { s: PtmStatement; demoId?: string }) => (
    <li className="leading-snug" data-demo-id={demoId}>
      {s[lang]}{" "}
      {s.factIds.map((id) => {
        const src = sources[id];
        if (!src) return null;
        return src.href ? (
          <Link key={id} href={src.href} className="align-super text-[0.55em] font-medium text-primary hover:underline print:text-gray-500" title="Source">
            [{src.label}]
          </Link>
        ) : (
          <span key={id} className="align-super text-[0.55em] text-muted-foreground">
            [{src.label}]
          </span>
        );
      })}
    </li>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 text-[20px] print:max-w-none print:space-y-3 print:p-0 print:text-[11pt]" data-demo-id="ptm-summary" data-lang={lang}>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft /> Back
          </Link>
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setLang(lang === "en" ? "hi" : "en")} data-demo-id="ptm-language-toggle">
            <Languages /> {t.lang}
          </Button>
          <Button onClick={() => window.print()} data-demo-id="ptm-print">
            <Printer /> Print (1 page)
          </Button>
        </div>
      </div>
      {summary.notice && <Alert tone="warn" className="no-print text-sm">{summary.notice}</Alert>}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <div>
          <div className="text-base text-muted-foreground print:text-[9pt]">{t.title}</div>
          <h1 className="text-4xl font-semibold tracking-tight print:text-[18pt]" data-demo-id="ptm-student-name">
            {student.name}
          </h1>
        </div>
        <div className="text-base text-muted-foreground print:text-[9pt]">
          Class {student.section} · Roll {student.rollNumber} · Mathematics · {teacherName}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] print:grid-cols-[1.1fr_1fr] print:gap-4">
        <section>
          <h2 className="mb-2 text-xl font-semibold print:text-[12pt]">{t.trend}</h2>
          <TrendLineChart demoId="ptm-trend" data={trend} seriesName={student.firstName} compareName={t.cls} height={230} />
        </section>
        <div className="space-y-5 print:space-y-2">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-high print:text-[12pt]">✓ {t.strengths}</h2>
            <ul className="list-disc space-y-1.5 pl-6" data-demo-id="ptm-strengths">
              {summary.strengths.map((s, i) => (
                <Statement key={i} s={s} />
              ))}
              {summary.strengths.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-semibold text-low print:text-[12pt]">▲ {t.focus}</h2>
            <ul className="list-disc space-y-1.5 pl-6" data-demo-id="ptm-focus">
              {summary.focusAreas.map((s, i) => (
                <Statement key={i} s={s} />
              ))}
              {summary.focusAreas.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2 print:gap-4">
        <section className="rounded-xl border p-4 print:p-2">
          <h2 className="mb-2 text-xl font-semibold print:text-[12pt]">{t.term}</h2>
          <ul className="list-disc space-y-1.5 pl-6" data-demo-id="ptm-term">
            {summary.termStory.map((s, i) => (
              <Statement key={i} s={s} />
            ))}
          </ul>
        </section>
        <section className="rounded-xl border-2 border-primary/30 bg-accent/40 p-4 print:p-2">
          <h2 className="mb-2 text-xl font-semibold print:text-[12pt]">{t.talk}</h2>
          <ol className="list-decimal space-y-2 pl-6" data-demo-id="ptm-talking-points">
            {summary.talkingPoints.map((s, i) => (
              <Statement key={i} s={s} />
            ))}
          </ol>
        </section>
      </div>
      <p className="text-xs text-muted-foreground print:text-[7pt]">
        Based only on graded and reviewed work. Links show the source test or question. {summary.generatedBy === "ai" ? "Wording drafted by AI from these facts." : ""}
      </p>
    </div>
  );
}
