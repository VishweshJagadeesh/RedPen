/**
 * Mock planner: a deterministic reteach plan built from the class's evidence (misconception labels,
 * counts and real snippets). Every misconception section cites the misconception it tackles.
 * English, Hindi and mixed (Hinglish) are supported. Regenerating a section moves to the next variant.
 */
import { C8_EXIT_TICKET_TRANSPOSING } from "../fixtures/papers";
import type { PlanSectionKindT } from "../ai/schemas";
import type { PlanEvidence, PlanInputs, PlanLanguage, PlanQuestion, PlanSection } from "./types";

const BASE_MINUTES: Partial<Record<PlanSectionKindT, number>> = {
  prerequisite_check: 3,
  hook: 4,
  explanation: 8,
  worked_example: 7,
  misconception: 6,
  guided_practice: 7,
  exit_ticket_step: 5,
};

export function allocateMinutes(period: number): Partial<Record<PlanSectionKindT, number>> {
  const total = Object.values(BASE_MINUTES).reduce((s, v) => s + (v ?? 0), 0);
  const out: Partial<Record<PlanSectionKindT, number>> = {};
  let used = 0;
  const kinds = Object.keys(BASE_MINUTES) as PlanSectionKindT[];
  kinds.forEach((k, i) => {
    const m = i === kinds.length - 1 ? Math.max(2, period - used) : Math.max(2, Math.round(((BASE_MINUTES[k] ?? 0) * period) / total));
    out[k] = m;
    used += m;
  });
  return out;
}

type Tri = Record<PlanLanguage, string>;
const t = (en: string, hi: string, mixed: string): Tri => ({ en, hi, mixed });

// Worked examples / practice sets for transposing, rotated on regenerate.
const WORKED = [
  { eq: "4x + 5 = 2x + 13", lines: ["4x − 2x = 13 − 5", "2x = 8", "x = 4"], check: "4(4) + 5 = 21, 2(4) + 13 = 21 ✓" },
  { eq: "7y − 3 = 4y + 9", lines: ["7y − 4y = 9 + 3", "3y = 12", "y = 4"], check: "7(4) − 3 = 25, 4(4) + 9 = 25 ✓" },
  { eq: "15 − 2a = a + 3", lines: ["−2a − a = 3 − 15", "−3a = −12", "a = 4"], check: "15 − 8 = 7, 4 + 3 = 7 ✓" },
];
const PRACTICE = [
  ["x + 9 = 4", "3y − 7 = 11", "12 − 2p = 4"],
  ["x − 6 = −2", "5k + 4 = 19", "10 − 3m = 1"],
  ["a + 12 = 5", "4n − 9 = 7", "8 − 5q = −2"],
];

function transposingSections(ev: PlanEvidence, inputs: PlanInputs, variant: number) {
  const L = inputs.language;
  const sign = ev.misconceptions.find((m) => /sign/i.test(m.label));
  const oneSide = ev.misconceptions.find((m) => /one side/i.test(m.label));
  const slip = ev.misconceptions.find((m) => /slip/i.test(m.label));
  const first = sign ?? ev.misconceptions[0];
  const second = oneSide ?? ev.misconceptions.find((m) => m !== first);
  const signSnippet = ev.snippets.find((s) => s.misconception === first?.label);
  const oneSideSnippet = ev.snippets.find((s) => s.misconception === second?.label);
  const w = WORKED[variant % WORKED.length];
  const p = PRACTICE[variant % PRACTICE.length];
  const board = inputs.resources === "projector" ? t("on the projector", "प्रोजेक्टर पर", "projector par") : t("on the board", "बोर्ड पर", "board par");
  const worksheet = inputs.resources === "worksheets";
  const firstLine = (s?: { text: string }) => s?.text.split("\n")[0] ?? "";

  return {
    objective: t(
      "By the end of the period, students can move a term across the equals sign by changing its sign (+ becomes −, × becomes ÷), and check the answer by substitution.",
      "पीरियड के अंत तक विद्यार्थी '=' के पार पद ले जाते समय उसका चिह्न बदल सकेंगे (+ से −, × से ÷) और उत्तर रखकर जाँच सकेंगे।",
      "Period ke end tak students '=' ke paar term le jaate waqt uska sign badal sakenge (+ se −, × se ÷) aur answer substitute karke check kar sakenge.",
    )[L],
    prerequisite: {
      body: t(
        "Two quick questions, answered on fingers or in rough work. If many get Q1 wrong, spend one minute on adding and subtracting negative numbers first.",
        "दो छोटे प्रश्न — उँगलियों पर या रफ़ में उत्तर। अगर बहुत से Q1 गलत करें, तो पहले एक मिनट ऋणात्मक संख्याओं के जोड़-घटाव पर दीजिए।",
        "Do chhote questions — ungliyon par ya rough mein answer. Agar zyada students Q1 galat karein, toh pehle ek minute negative numbers ke add/subtract par dijiye.",
      )[L],
      questions: [
        { text: t("What is 7 − 12?", "7 − 12 कितना है?", "7 − 12 kitna hai?")[L], answer: "−5", marks: 1, rubric: [{ step: "−5", marks: 1 }] },
        { text: t("If 3 + x = 10, what is x?", "यदि 3 + x = 10, तो x क्या है?", "Agar 3 + x = 10, toh x kya hai?")[L], answer: "7", marks: 1, rubric: [{ step: "x = 7", marks: 1 }] },
      ] as PlanQuestion[],
    },
    hook:
      variant % 2 === 0
        ? t(
            `Draw a balance (taraazu) ${board.en} with 3x + 5 on one pan and 20 on the other. Ask: "If I take 5 away from the left pan, what must I do to the right pan to keep it level?" Take two or three answers before moving on.`,
            `${board.hi} एक तराज़ू बनाइए: एक पलड़े पर 3x + 5, दूसरे पर 20। पूछिए: "अगर बाएँ पलड़े से 5 हटाएँ, तो दाएँ पलड़े के साथ क्या करें कि तराज़ू बराबर रहे?" आगे बढ़ने से पहले दो-तीन उत्तर लीजिए।`,
            `${board.mixed} ek taraazu banaiye: ek palde par 3x + 5, doosre par 20. Poochhiye: "Agar left palde se 5 hata dein, toh right palde ke saath kya karein ki balance bana rahe?" Do-teen answers lijiye.`,
          )[L]
        : t(
            `Write "x + 5 = 12" ${board.en}. Ask a student to undo "+ 5" the way they would undo walking 5 steps forward — walk 5 steps back. Link "undo" to "change the sign when it crosses =".`,
            `${board.hi} "x + 5 = 12" लिखिए। किसी विद्यार्थी से कहिए कि "+ 5" को वैसे ही उलटे जैसे 5 कदम आगे चलने को 5 कदम पीछे चलकर उलटते हैं। "उलटना" को "= पार करने पर चिह्न बदलना" से जोड़िए।`,
            `${board.mixed} "x + 5 = 12" likhiye. Ek student se kahiye ki "+ 5" ko waise hi undo kare jaise 5 kadam aage chalne ko 5 kadam peeche chal kar undo karte hain. "Undo" ko "= cross karne par sign badalna" se jodiye.`,
          )[L],
    explanation: first
      ? t(
          `${first.count} students ${first.label.toLowerCase().replace(/^moves/, "moved")}${signSnippet ? ` — for example "${firstLine(signSnippet)}" (${signSnippet.source})` : ""}. Show why it is wrong: subtract 5 from BOTH sides — 3x + 5 − 5 = 20 − 5 — so 3x = 20 − 5. "Transposing" is only a shortcut for doing the same thing to both sides; the sign flips because we subtracted. Write the rule: + ↔ −, × ↔ ÷ when a term crosses "=".`,
          `${first.count} विद्यार्थियों ने यह गलती की: ${first.label}${signSnippet ? ` — जैसे "${firstLine(signSnippet)}" (${signSnippet.source})` : ""}। दिखाइए क्यों गलत है: दोनों पक्षों से 5 घटाइए — 3x + 5 − 5 = 20 − 5 — इसलिए 3x = 20 − 5। पक्षांतरण बस दोनों तरफ़ एक ही काम करने का छोटा तरीका है; चिह्न इसलिए बदलता है क्योंकि हमने घटाया। नियम लिखिए: '=' पार करने पर + ↔ −, × ↔ ÷।`,
          `${first.count} students ne yeh galti ki: ${first.label}${signSnippet ? ` — jaise "${firstLine(signSnippet)}" (${signSnippet.source})` : ""}. Dikhaiye kyun galat hai: dono sides se 5 subtract kijiye — 3x + 5 − 5 = 20 − 5 — isliye 3x = 20 − 5. Transposing sirf dono taraf same kaam karne ka shortcut hai; sign isliye badalta hai kyunki humne subtract kiya. Rule likhiye: "=" cross karne par + ↔ −, × ↔ ÷.`,
        )[L]
      : "",
    worked: t(
      `Solve ${w.eq} together. ${w.lines.map((l, i) => `Step ${i + 1}: ${l}.`).join(" ")} Check: ${w.check}. Ask a student to say each sign change aloud as you write it.`,
      `मिलकर हल कीजिए: ${w.eq}। ${w.lines.map((l, i) => `चरण ${i + 1}: ${l}।`).join(" ")} जाँच: ${w.check}। लिखते समय हर चिह्न-परिवर्तन किसी विद्यार्थी से बुलवाइए।`,
      `Saath mein solve kijiye: ${w.eq}. ${w.lines.map((l, i) => `Step ${i + 1}: ${l}.`).join(" ")} Check: ${w.check}. Har sign change kisi student se bulwaiye.`,
    )[L],
    misconception: second
      ? t(
          `${second.count} students ${second.label.toLowerCase().replace(/^applies/, "applied")}${oneSideSnippet ? `, e.g. "${oneSideSnippet.text.split("\n").slice(0, 2).join(" → ")}" (${oneSideSnippet.source})` : ""}. Put it ${board.en} without saying whose it is and ask: "Is the balance still level?" Then fix it together: whatever you do to the left, do to the right.${slip ? ` (${slip.count} more had the right method but slipped on arithmetic — remind everyone to check by substituting.)` : ""}`,
          `${second.count} विद्यार्थियों ने यह किया: ${second.label}${oneSideSnippet ? `, जैसे "${oneSideSnippet.text.split("\n").slice(0, 2).join(" → ")}" (${oneSideSnippet.source})` : ""}। बिना नाम लिए ${board.hi} लिखिए और पूछिए: "क्या तराज़ू अब भी बराबर है?" फिर मिलकर सुधारिए: जो बाईं ओर करें, वही दाईं ओर भी।${slip ? ` (${slip.count} और विद्यार्थियों की विधि सही थी पर गणना में चूक हुई — सबको उत्तर रखकर जाँचने की याद दिलाइए।)` : ""}`,
          `${second.count} students ne yeh kiya: ${second.label}${oneSideSnippet ? `, jaise "${oneSideSnippet.text.split("\n").slice(0, 2).join(" → ")}" (${oneSideSnippet.source})` : ""}. Bina naam liye ${board.mixed} likhiye aur poochhiye: "Kya balance abhi bhi barabar hai?" Phir saath mein theek kijiye: jo left mein karein, wahi right mein bhi.${slip ? ` (${slip.count} aur students ka method sahi tha par calculation mein slip hua — sabko substitute karke check karne ko kahiye.)` : ""}`,
        )[L]
      : "",
    guided: t(
      `In the peer pairs below, solve: (a) ${p[0]}, (b) ${p[1]}, (c) ${p[2]}${worksheet ? " (on the worksheet)" : ""}. The mentor explains each sign change; the learner writes. Walk round and check line 1 of every answer — that is where the sign error shows up.`,
      `नीचे दी गई जोड़ियों में हल करें: (a) ${p[0]}, (b) ${p[1]}, (c) ${p[2]}${worksheet ? " (वर्कशीट पर)" : ""}। मेंटर हर चिह्न-परिवर्तन समझाए, सीखने वाला लिखे। घूमकर हर उत्तर की पहली पंक्ति देखिए — चिह्न की गलती वहीं दिखती है।`,
      `Neeche diye pairs mein solve karein: (a) ${p[0]}, (b) ${p[1]}, (c) ${p[2]}${worksheet ? " (worksheet par)" : ""}. Mentor har sign change samjhaye, learner likhe. Ghoom kar har answer ki pehli line dekhiye — sign ki galti wahin dikhti hai.`,
    )[L],
    exitStep: t(
      "Students attempt the 4 exit-ticket questions alone on a half sheet with name and roll number. Collect them, photograph them and upload them to RedPen for grading.",
      "विद्यार्थी अकेले 4 एग्ज़िट-टिकट प्रश्न आधे पन्ने पर, नाम और रोल नंबर के साथ हल करें। इकट्ठा करके फ़ोटो लें और ग्रेडिंग के लिए RedPen पर अपलोड करें।",
      "Students akele 4 exit-ticket questions half sheet par, naam aur roll number ke saath solve karein. Collect karke photo lijiye aur grading ke liye RedPen par upload kijiye.",
    )[L],
    board: [
      t("LHS | RHS", "बायाँ पक्ष | दायाँ पक्ष", "LHS | RHS")[L],
      "3x + 5 = 20",
      t("3x + 5 − 5 = 20 − 5   (same on both sides)", "3x + 5 − 5 = 20 − 5   (दोनों तरफ़ एक जैसा)", "3x + 5 − 5 = 20 − 5   (dono taraf same)")[L],
      "3x = 15",
      "x = 5",
      t('Shortcut: +5 crosses "=" → becomes −5', "छोटा तरीका: +5 '=' पार करे → −5 बन जाता है", 'Shortcut: +5 "=" cross kare → −5 ban jaata hai')[L],
      t("Rule: + ↔ −    × ↔ ÷", "नियम: + ↔ −    × ↔ ÷", "Rule: + ↔ −    × ↔ ÷")[L],
      t("Check: 3(5) + 5 = 20 ✓", "जाँच: 3(5) + 5 = 20 ✓", "Check: 3(5) + 5 = 20 ✓")[L],
    ].join("\n"),
    pairs: t(
      "Each mentor scored at least 60% on this concept; learners scored under 50%. Mentors explain, learners write. Reshuffle if two friends will chat.",
      "हर मेंटर ने इस अवधारणा में कम से कम 60% अंक पाए; सीखने वालों ने 50% से कम। मेंटर समझाएँ, सीखने वाले लिखें। अगर दो दोस्त बातें करेंगे तो बदल दीजिए।",
      "Har mentor ne is concept mein kam se kam 60% score kiya; learners ne 50% se kam. Mentor samjhaye, learner likhe. Agar do dost baatein karenge toh reshuffle kijiye.",
    )[L],
    extension: t(
      "For students who finish early: (1) Solve (x/3) + 4 = 10. (2) Make up an equation whose answer is x = −2 and swap it with a partner. (3) In one sentence, explain why −2y = 1 − 7 and not 1 + 7.",
      "जल्दी खत्म करने वालों के लिए: (1) (x/3) + 4 = 10 हल करें। (2) ऐसा समीकरण बनाइए जिसका उत्तर x = −2 हो और साथी से बदलिए। (3) एक वाक्य में समझाइए कि −2y = 1 − 7 क्यों, 1 + 7 क्यों नहीं।",
      "Jaldi khatam karne walon ke liye: (1) (x/3) + 4 = 10 solve karein. (2) Aisa equation banaiye jiska answer x = −2 ho aur partner se exchange kijiye. (3) Ek line mein samjhaiye ki −2y = 1 − 7 kyun, 1 + 7 kyun nahin.",
    )[L],
    exitTicket: C8_EXIT_TICKET_TRANSPOSING.questions.map((q) => ({ text: q.text, answer: q.answerKey, marks: q.maxMarks, rubric: q.rubric })),
    firstLabel: first?.label,
    secondLabel: second?.label,
    slipLabel: slip?.label,
  };
}

function genericSections(ev: PlanEvidence, inputs: PlanInputs, variant: number) {
  const L = inputs.language;
  const [m1, m2] = ev.misconceptions.filter((m) => !/unattempted/i.test(m.label));
  const s1 = ev.snippets.find((s) => s.misconception === m1?.label);
  const s2 = ev.snippets.find((s) => s.misconception === m2?.label);
  const qs = ev.sourceQuestions;
  const example = qs[variant % Math.max(1, qs.length)];
  const name = ev.conceptName;
  return {
    objective: t(`By the end of the period, students can solve problems on "${name}" correctly, step by step, and check their answer.`, `पीरियड के अंत तक विद्यार्थी "${name}" के प्रश्न चरण-दर-चरण सही हल कर सकेंगे और उत्तर जाँच सकेंगे।`, `Period ke end tak students "${name}" ke questions step-by-step sahi solve kar sakenge aur answer check kar sakenge.`)[L],
    prerequisite: {
      body: t("Two quick warm-up questions on the skills this concept needs.", "इस अवधारणा के लिए ज़रूरी कौशल पर दो छोटे प्रश्न।", "Is concept ke liye zaroori skills par do chhote warm-up questions.")[L],
      questions: (qs.slice(0, 2).length ? qs.slice(0, 2) : [{ text: "—", answer: "—", marks: 1, rubric: [{ step: "Answer", marks: 1 }] }]).map((q) => ({ ...q, text: `${q.text}` })),
    },
    hook: t(`Write one wrong answer from the test ${s1 ? `("${s1.text.split("\n")[0]}")` : ""} on the board and ask the class to find the mistake.`, `टेस्ट का एक गलत उत्तर ${s1 ? `("${s1.text.split("\n")[0]}")` : ""} बोर्ड पर लिखिए और कक्षा से गलती ढूँढने को कहिए।`, `Test ka ek galat answer ${s1 ? `("${s1.text.split("\n")[0]}")` : ""} board par likhiye aur class se galti dhoondhne ko kahiye.`)[L],
    explanation: m1 ? t(`${m1.count} students: ${m1.label}${s1 ? ` (e.g. ${s1.source})` : ""}. Show the correct step next to the wrong one and say why it is correct.`, `${m1.count} विद्यार्थी: ${m1.label}${s1 ? ` (जैसे ${s1.source})` : ""}। गलत चरण के साथ सही चरण लिखिए और बताइए क्यों सही है।`, `${m1.count} students: ${m1.label}${s1 ? ` (jaise ${s1.source})` : ""}. Galat step ke saath sahi step likhiye aur batayiye kyun sahi hai.`)[L] : "",
    worked: example ? `${example.text}\n${example.answer}` : "",
    misconception: m2 ? t(`${m2.count} students: ${m2.label}${s2 ? ` (e.g. ${s2.source})` : ""}. Ask the class to spot it, then fix it together.`, `${m2.count} विद्यार्थी: ${m2.label}${s2 ? ` (जैसे ${s2.source})` : ""}। कक्षा से पहचानने को कहिए, फिर मिलकर सुधारिए।`, `${m2.count} students: ${m2.label}${s2 ? ` (jaise ${s2.source})` : ""}. Class se pehchaanne ko kahiye, phir saath mein theek kijiye.`)[L] : "",
    guided: t("Peer pairs solve two questions like the worked example; the mentor explains, the learner writes.", "जोड़ियाँ उदाहरण जैसे दो प्रश्न हल करें; मेंटर समझाए, सीखने वाला लिखे।", "Pairs worked example jaise do questions solve karein; mentor samjhaye, learner likhe.")[L],
    exitStep: t("Students attempt the exit ticket alone. Collect, photograph and upload for grading.", "विद्यार्थी अकेले एग्ज़िट टिकट हल करें। इकट्ठा करके फ़ोटो लें और अपलोड करें।", "Students akele exit ticket solve karein. Collect karke photo lijiye aur upload kijiye.")[L],
    board: [name, ...(example ? example.answer.split("\n").slice(0, 6) : [])].join("\n"),
    pairs: t("Mentors scored at least 60% on this concept; learners scored under 50%.", "मेंटर ने इस अवधारणा में कम से कम 60% पाए; सीखने वालों ने 50% से कम।", "Mentors ne is concept mein kam se kam 60% score kiya; learners ne 50% se kam.")[L],
    extension: t("Make up a harder question of the same type and solve it; swap with a partner.", "इसी प्रकार का कठिन प्रश्न बनाइए और हल कीजिए; साथी से बदलिए।", "Isi type ka mushkil question banaiye aur solve kijiye; partner se exchange kijiye.")[L],
    exitTicket: qs.slice(0, 4).map((q) => ({ ...q })),
    firstLabel: m1?.label,
    secondLabel: m2?.label,
    slipLabel: undefined as string | undefined,
  };
}

const TITLES: Record<PlanSectionKindT, Tri> = {
  objective: t("Learning objective", "सीखने का उद्देश्य", "Learning objective"),
  prerequisite_check: t("Prerequisite check", "पूर्व-ज्ञान जाँच", "Prerequisite check"),
  hook: t("Hook", "शुरुआत", "Hook"),
  explanation: t("Explanation", "समझाइए", "Explanation"),
  worked_example: t("Worked example", "हल किया हुआ उदाहरण", "Worked example"),
  misconception: t("Tackle a misconception", "गलतफ़हमी दूर करें", "Misconception tackle karein"),
  guided_practice: t("Guided practice", "मार्गदर्शित अभ्यास", "Guided practice"),
  exit_ticket_step: t("Exit ticket", "एग्ज़िट टिकट", "Exit ticket"),
  board_plan: t("Board plan", "बोर्ड योजना", "Board plan"),
  peer_pairs: t("Peer pairs", "साथी जोड़ियाँ", "Peer pairs"),
  extension: t("Extension work", "अतिरिक्त कार्य", "Extension work"),
  exit_ticket: t("Exit ticket questions", "एग्ज़िट टिकट प्रश्न", "Exit ticket questions"),
};

export function mockPlanSections(ev: PlanEvidence, inputs: PlanInputs, variant = 0): Omit<PlanSection, "id">[] {
  const c = ev.conceptId === "c8-le-transposing" ? transposingSections(ev, inputs, variant) : genericSections(ev, inputs, variant);
  const mins = allocateMinutes(inputs.periodMinutes);
  const L = inputs.language;
  const title = (k: PlanSectionKindT) => TITLES[k][L];
  const noteLine = inputs.note.trim() ? `\n\n${t("Your note", "आपका नोट", "Aapka note")[L]}: ${inputs.note.trim()}` : "";
  const sections: Omit<PlanSection, "id">[] = [
    { kind: "objective", title: title("objective"), minutes: 0, body: c.objective + noteLine, citesMisconceptions: [], questions: [] },
    { kind: "prerequisite_check", title: title("prerequisite_check"), minutes: mins.prerequisite_check ?? 3, body: c.prerequisite.body, citesMisconceptions: [], questions: c.prerequisite.questions },
    { kind: "hook", title: title("hook"), minutes: mins.hook ?? 4, body: c.hook, citesMisconceptions: [], questions: [] },
    {
      kind: "explanation",
      title: `${title("explanation")}${c.firstLabel ? ` — #1` : ""}`,
      minutes: mins.explanation ?? 8,
      body: c.explanation,
      citesMisconceptions: c.firstLabel ? [c.firstLabel] : [],
      questions: [],
    },
    { kind: "worked_example", title: title("worked_example"), minutes: mins.worked_example ?? 7, body: c.worked, citesMisconceptions: c.firstLabel ? [c.firstLabel] : [], questions: [] },
    {
      kind: "misconception",
      title: `${title("misconception")}${c.secondLabel ? ` — #2` : ""}`,
      minutes: mins.misconception ?? 6,
      body: c.misconception,
      citesMisconceptions: [c.secondLabel, c.slipLabel].filter((x): x is string => !!x),
      questions: [],
    },
    { kind: "guided_practice", title: title("guided_practice"), minutes: mins.guided_practice ?? 7, body: c.guided, citesMisconceptions: [], questions: [] },
    { kind: "exit_ticket_step", title: title("exit_ticket_step"), minutes: mins.exit_ticket_step ?? 5, body: c.exitStep, citesMisconceptions: [], questions: [] },
    { kind: "board_plan", title: title("board_plan"), minutes: 0, body: c.board, citesMisconceptions: [], questions: [] },
    { kind: "peer_pairs", title: title("peer_pairs"), minutes: 0, body: c.pairs, citesMisconceptions: [], questions: [] },
    { kind: "extension", title: title("extension"), minutes: 0, body: c.extension, citesMisconceptions: [], questions: [] },
    { kind: "exit_ticket", title: title("exit_ticket"), minutes: 0, body: "", citesMisconceptions: [], questions: c.exitTicket },
  ];
  return sections.filter((s) => s.kind !== "misconception" || s.body);
}

export function mockRegenerateSection(ev: PlanEvidence, inputs: PlanInputs, section: PlanSection): Omit<PlanSection, "id"> {
  const variant = (section.variant ?? 0) + 1;
  const fresh = mockPlanSections(ev, inputs, variant).find((s) => s.kind === section.kind) ?? section;
  return { ...fresh, minutes: section.minutes, variant };
}
