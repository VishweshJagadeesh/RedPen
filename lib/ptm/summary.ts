/**
 * PTM summary: plain-language statements in English and Hindi, built only from extracted facts.
 * Every statement carries the ids of the facts it uses, so the UI can link it to its source.
 */
import { aiMode, planningModel } from "../ai/mode";
import { AiError, callStructured } from "../ai/client";
import { PtmSummarySchema } from "../ai/schemas";
import { misconceptionHindi } from "../fixtures/concepts";
import type { Fact, StudentFacts } from "./facts";

export interface PtmStatement {
  en: string;
  hi: string;
  factIds: string[];
}

export interface PtmSummaryData {
  strengths: PtmStatement[];
  focusAreas: PtmStatement[];
  termStory: PtmStatement[];
  talkingPoints: PtmStatement[];
  generatedBy: "template" | "ai";
  notice: string | null;
}

function plainMisconception(f: Fact, first: string): { en: string; hi: string } {
  const m = (f.data.misconception as string | null) ?? "";
  if (/without changing its sign/i.test(m))
    return {
      en: `when a number moves to the other side of “=”, its sign should change (+ becomes −); ${first}'s answers often keep the same sign`,
      hi: `जब कोई संख्या “=” के दूसरी तरफ़ जाती है तो उसका चिह्न बदलना चाहिए (+ से −); ${first} के उत्तरों में अक्सर चिह्न नहीं बदला गया`,
    };
  if (/one side only/i.test(m))
    return { en: `${first} sometimes changes only one side of an equation; both sides must change together`, hi: `${first} के उत्तरों में कभी-कभी समीकरण का केवल एक पक्ष बदला गया; दोनों पक्ष साथ बदलने चाहिए` };
  if (/slip/i.test(m)) return { en: "the method is right, but small calculation mistakes cost marks", hi: "विधि सही है, पर छोटी गणना की गलतियों से अंक कटे" };
  if (f.data.blank || !m) return { en: "some questions on this were left blank or unfinished", hi: "इस विषय के कुछ प्रश्न खाली या अधूरे छोड़े गए" };
  return { en: m.toLowerCase(), hi: misconceptionHindi(m) ?? "कुछ गलतियाँ हुईं" };
}

const HOME_TIPS: { test: (f: Fact) => boolean; en: (n: string) => string; hi: (n: string) => string }[] = [
  {
    test: (f) => /without changing its sign|one side only/i.test((f.data.misconception as string) ?? ""),
    en: (n) => `At home, ask ${n} to solve 2–3 equations aloud for 10 minutes and say “the sign changes” every time a number crosses “=”.`,
    hi: (n) => `घर पर ${n} से रोज़ 10 मिनट 2–3 समीकरण बोलकर हल करवाइए, और हर बार जब कोई संख्या “=” पार करे तो “चिह्न बदलेगा” कहलवाइए।`,
  },
  {
    test: (f) => !!f.data.blank,
    en: (n) => `Please keep a fixed 20-minute study time on school days, and encourage ${n} to attempt every question — a started answer earns step marks.`,
    hi: (n) => `स्कूल के दिनों में पढ़ाई का 20 मिनट का तय समय रखिए, और ${n} को हर प्रश्न हल करने की कोशिश के लिए प्रोत्साहित कीजिए — शुरू किए उत्तर पर भी चरण के अंक मिलते हैं।`,
  },
  {
    test: (f) => /slip/i.test((f.data.misconception as string) ?? ""),
    en: (n) => `Ask ${n} to check each answer by putting it back into the question — it catches most calculation slips.`,
    hi: (n) => `${n} से हर उत्तर को प्रश्न में वापस रखकर जाँचने को कहिए — इससे ज़्यादातर गणना की गलतियाँ पकड़ में आ जाती हैं।`,
  },
];

export function templateSummary(sf: StudentFacts): PtmSummaryData {
  const n = sf.student.firstName;
  const strengths = sf.strengths.map((f) => ({
    en: `Strong in ${f.data.concept} (${f.data.pct}%).`,
    hi: `${f.data.concept} में मज़बूत (${f.data.pct}%)।`,
    factIds: [f.id],
  }));
  const focusAreas = sf.focus.map((f) => {
    const p = plainMisconception(f, n);
    return { en: `${f.data.concept} (${f.data.pct}%): ${p.en}.`, hi: `${f.data.concept} (${f.data.pct}%): ${p.hi}।`, factIds: [f.id] };
  });

  const termStory: PtmStatement[] = [];
  for (const f of sf.term) {
    if (f.kind === "flag") {
      const d = f.data;
      if (d.type === "missed_submissions") {
        termStory.push({
          en: `Missed ${d.missedCount} of the last ${d.windowSize} tests${d.latestPct !== null && d.prevAvg !== null && (d.prevAvg as number) > (d.latestPct as number) ? `, and the score then fell from ${d.prevAvg}% to ${d.latestPct}%` : ""}.`,
          hi: `पिछले ${d.windowSize} टेस्ट में से ${d.missedCount} में अनुपस्थित${d.latestPct !== null && d.prevAvg !== null && (d.prevAvg as number) > (d.latestPct as number) ? `, और फिर अंक ${d.prevAvg}% से घटकर ${d.latestPct}% रह गए` : ""}।`,
          factIds: [f.id],
        });
      } else if (d.type === "sudden_drop" && d.prevAvg !== null) {
        termStory.push({
          en: `Scores dropped from an average of ${d.prevAvg}% to ${d.latestPct}% in ${d.trigger}.`,
          hi: `${d.trigger} में अंक ${d.prevAvg}% के औसत से घटकर ${d.latestPct}% रह गए।`,
          factIds: [f.id],
        });
      } else if (d.regression) {
        const r = d.regression as { name: string; beforePct: number; afterPct: number };
        termStory.push({ en: `${r.name} fell from ${r.beforePct}% to ${r.afterPct}% in ${d.trigger}.`, hi: `${d.trigger} में ${r.name} ${r.beforePct}% से घटकर ${r.afterPct}% रह गया।`, factIds: [f.id] });
      } else {
        termStory.push({ en: f.text, hi: f.text, factIds: [f.id] });
      }
    } else if (f.kind === "action") {
      termStory.push({ en: f.text, hi: /Remedial sheet assigned/.test(f.text) ? "अभ्यास के लिए एक रेमेडियल शीट दी गई।" : "शिक्षक ने कदम उठाया।", factIds: [f.id] });
    } else if (f.kind === "result") {
      const m = f.text.match(/Remedial sheet: ([\d.]+)\/([\d.]+) \((\d+)%\) on (.+?)(?:, up from (\d+)% in (\w+))?\./);
      termStory.push({
        en: f.text,
        hi: m ? `रेमेडियल शीट में ${m[1]}/${m[2]} (${m[3]}%) अंक, ${m[4]} पर${m[5] ? ` — ${m[6]} के ${m[5]}% से बेहतर` : ""}।` : "सुधार दिख रहा है।",
        factIds: [f.id],
      });
    } else if (f.kind === "class") {
      termStory.push({
        en: f.text,
        hi: `कक्षा में विषय दोबारा पढ़ाने के बाद एग्ज़िट टिकट में ${n} के ${f.data.got}/${f.data.max} अंक आए।`,
        factIds: [f.id],
      });
    }
  }
  if (termStory.length === 0) {
    const last = sf.facts.filter((f) => f.kind === "score" && !f.data.absent).at(-1);
    if (last) termStory.push({ en: `Steady term so far. Latest: ${last.data.pct}% in ${last.data.title} (class average ${last.data.classAvg}%).`, hi: `अब तक का सत्र स्थिर रहा। हाल का: ${last.data.title} में ${last.data.pct}% (कक्षा औसत ${last.data.classAvg}%)।`, factIds: [last.id] });
  }

  const talkingPoints: PtmStatement[] = [];
  const topFocus = sf.focus[0];
  const pending = sf.pending[0];
  if (topFocus) {
    talkingPoints.push({
      en: `Our main focus is ${topFocus.data.concept}. We are practising it in class${pending ? " and with a short remedial sheet" : ""}.`,
      hi: `हमारा मुख्य ध्यान ${topFocus.data.concept} पर है। कक्षा में इसका अभ्यास हो रहा है${pending ? " और एक छोटी रेमेडियल शीट भी दी गई है" : ""}।`,
      factIds: [topFocus.id, ...(pending ? [pending.id] : [])],
    });
  }
  const topStrength = sf.strengths[0];
  if (topStrength) {
    talkingPoints.push({
      en: `Please praise ${n}'s work in ${topStrength.data.concept} — ${topStrength.data.pct}% shows real understanding.`,
      hi: `कृपया ${topStrength.data.concept} में ${n} के काम की तारीफ़ कीजिए — ${topStrength.data.pct}% अच्छी समझ दिखाता है।`,
      factIds: [topStrength.id],
    });
  }
  const tipFact = sf.focus.find((f) => HOME_TIPS.some((t) => t.test(f)));
  const tip = tipFact ? HOME_TIPS.find((t) => t.test(tipFact)) : null;
  if (tip && tipFact) talkingPoints.push({ en: tip.en(n), hi: tip.hi(n), factIds: [tipFact.id] });
  else {
    const anchor = topFocus ?? topStrength ?? sf.facts.find((f) => f.kind === "score");
    if (anchor)
      talkingPoints.push({
        en: `At home, ask ${n} to show you one solved question each evening and explain the steps aloud.`,
        hi: `घर पर ${n} से रोज़ शाम एक हल किया हुआ प्रश्न दिखाने और उसके चरण बोलकर समझाने को कहिए।`,
        factIds: [anchor.id],
      });
  }
  return { strengths, focusAreas, termStory, talkingPoints: talkingPoints.slice(0, 3), generatedBy: "template", notice: null };
}

export function validateSummary(s: Omit<PtmSummaryData, "generatedBy" | "notice">, facts: Fact[]): string[] {
  const ids = new Set(facts.map((f) => f.id));
  const problems: string[] = [];
  const lists: [string, PtmStatement[]][] = [
    ["strengths", s.strengths],
    ["focus area", s.focusAreas],
    ["term story", s.termStory],
    ["talking point", s.talkingPoints],
  ];
  for (const [key, list] of lists) {
    for (const st of list) {
      if (st.factIds.length === 0) problems.push(`a ${key} statement has no source fact`);
      const bad = st.factIds.filter((id) => !ids.has(id));
      if (bad.length) problems.push(`a ${key} statement cites unknown facts: ${bad.join(", ")}`);
    }
  }
  if (s.talkingPoints.length !== 3 && facts.length >= 3) problems.push("there must be exactly 3 talking points");
  return problems;
}

const cache = new Map<string, PtmSummaryData>();

async function liveSummary(sf: StudentFacts): Promise<PtmSummaryData> {
  const key = JSON.stringify(sf.facts.map((f) => [f.id, f.text]));
  const hit = cache.get(key);
  if (hit) return hit;
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await callStructured({
      label: "PTM summary",
      model: planningModel(),
      system:
        "You write a parent-teacher meeting summary for an Indian school, in warm, plain language a parent understands, in English and in Hindi (Devanagari). Use ONLY the facts provided; every statement lists the fact ids it is based on. Do not invent scores, events, causes or anything about the family. Do not use gendered pronouns for the student; use their first name.",
      content: [
        {
          type: "text",
          text: `Student: ${sf.student.firstName}, Class ${sf.student.section}.
Facts (id — text):
${sf.facts.map((f) => `${f.id} — ${f.text}`).join("\n")}

Write: 2–3 strengths, 2–3 focus areas, the story of this term (alerts, actions taken, results), and exactly 3 talking points including one concrete thing the parent can do at home.${feedback}`,
        },
      ],
      schema: PtmSummarySchema,
    });
    const out = { strengths: res.data.strengths.slice(0, 3), focusAreas: res.data.focusAreas.slice(0, 3), termStory: res.data.termStory, talkingPoints: res.data.talkingPoints.slice(0, 3) };
    const problems = validateSummary(out, sf.facts);
    if (problems.length === 0) {
      const data = { ...out, generatedBy: "ai" as const, notice: null };
      cache.set(key, data);
      return data;
    }
    feedback = `\n\nYour previous answer failed these checks; fix them: ${problems.join("; ")}.`;
  }
  throw new AiError("The AI summary cited facts that are not in the data, twice.", "PTM summary", 2);
}

export async function ptmSummary(sf: StudentFacts): Promise<PtmSummaryData> {
  if (aiMode() !== "live") return templateSummary(sf);
  try {
    return await liveSummary(sf);
  } catch (e) {
    const t = templateSummary(sf);
    return { ...t, notice: `${e instanceof Error ? e.message : "The AI summary failed."} Showing the standard fact-based summary instead.` };
  }
}
