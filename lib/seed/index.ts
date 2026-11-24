/**
 * Resets the database to the exact seeded demo state. Used by `npm run db:seed` and by the
 * "Reset demo data" button in Settings. Everything comes from the typed fixtures in lib/fixtures.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { CONCEPTS } from "../fixtures/concepts";
import { SECTIONS, STUDENTS, TEACHER, studentsOf } from "../fixtures/school";
import { paper, sum } from "../fixtures/papers";
import { WT4_8B_ID, buildFixtures, questionId, submissionId, type GenAnswer } from "../fixtures/history";
import { SAMPLE_PAPERS, mockSheets } from "../fixtures/sheets";
import { proposeMatch } from "../grading/matching";

function addDays(iso: string, days: number): Date {
  const d = new Date(`${iso}T09:30:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function chunked<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

export async function resetDemoData(prisma: PrismaClient, log: (msg: string) => void = () => {}) {
  const fx = buildFixtures();

  log("Clearing tables…");
  await prisma.auditLog.deleteMany();
  await prisma.answerGrade.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.question.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.flag.deleteMany();
  await prisma.lessonPlan.deleteMany();
  await prisma.remedialAssignment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.section.deleteMany();
  await prisma.concept.deleteMany();
  await prisma.teacher.deleteMany();

  log("Teacher, sections, students, concepts…");
  await prisma.teacher.create({ data: { id: TEACHER.id, name: TEACHER.name, subject: TEACHER.subject } });
  await prisma.section.createMany({
    data: SECTIONS.map((s) => ({ id: s.id, teacherId: TEACHER.id, grade: s.grade, letter: s.letter, name: s.name, subject: s.subject, academicYear: s.academicYear })),
  });
  await prisma.student.createMany({ data: STUDENTS });
  // Parents before children so the self-relation is satisfied.
  await prisma.concept.createMany({ data: CONCEPTS.filter((c) => !c.parentId).map((c) => ({ ...c, parentId: null })) });
  await prisma.concept.createMany({ data: CONCEPTS.filter((c) => c.parentId).map((c) => ({ ...c, parentId: c.parentId! })) });

  log("Assessments and questions…");
  const sheets = mockSheets();
  for (const a of fx.assessments) {
    const p = paper(a.paperKey);
    const samplePaper = a.id === WT4_8B_ID ? SAMPLE_PAPERS["c8-wt4"] : undefined;
    await prisma.assessment.create({
      data: {
        id: a.id,
        sectionId: a.sectionId,
        title: a.title,
        type: a.type,
        date: new Date(`${a.date}T00:00:00Z`),
        status: a.graded ? "final" : "sheets_uploaded",
        fixtureKey: a.paperKey,
        questionPaperKeys: JSON.stringify(samplePaper?.paper ?? []),
        answerKeyKeys: JSON.stringify(samplePaper?.key ?? []),
        createdAt: addDays(a.date, 0),
        finalizedAt: a.graded ? addDays(a.date, 3) : null,
      },
    });
    await prisma.question.createMany({
      data: p.questions.map((q) => ({
        id: questionId(a.id, q.number),
        assessmentId: a.id,
        number: q.number,
        text: q.text,
        maxMarks: q.maxMarks,
        rubric: JSON.stringify(q.rubric),
        conceptIds: JSON.stringify(q.conceptIds),
        answerKey: q.answerKey,
      })),
    });
  }

  log("Submissions and graded answers…");
  const submissions: Prisma.SubmissionCreateManyInput[] = [];
  const grades: Prisma.AnswerGradeCreateManyInput[] = [];
  const audits: Prisma.AuditLogCreateManyInput[] = [];
  for (const a of fx.assessments) {
    const p = paper(a.paperKey);
    const roster = studentsOf(a.sectionId);
    for (const sub of a.submissions) {
      const subId = submissionId(a.id, sub.studentId);
      if (!a.graded) {
        // 8B WT4: uploaded and matched, waiting to be graded.
        const student = roster.find((s) => s.id === sub.studentId)!;
        const sheet = [...sheets.values()].find((s) => s.set === "8b-wt4" && s.studentId === student.id)!;
        const match = proposeMatch(sheet.detected, roster);
        submissions.push({
          id: subId,
          assessmentId: a.id,
          studentId: match.studentId,
          status: "matched",
          pageKeys: JSON.stringify(sheet.pageKeys),
          sheetRef: sheet.sheetRef,
          detectedName: sheet.detected.name,
          detectedRoll: sheet.detected.roll,
          matchConfidence: match.confidence,
          createdAt: addDays(a.date, 1),
        });
        continue;
      }
      submissions.push({
        id: subId,
        assessmentId: a.id,
        studentId: sub.studentId,
        status: sub.absent ? "absent" : "graded",
        pageKeys: "[]",
        createdAt: addDays(a.date, 1),
        gradedAt: sub.absent ? null : addDays(a.date, 1),
      });
      for (const ans of sub.answers) {
        const q = p.questions.find((x) => x.number === ans.questionNumber)!;
        grades.push(gradeRow(subId, questionId(a.id, q.number), q.rubric, q.conceptIds, ans, addDays(a.date, 2)));
        if (ans.status === "overridden") {
          audits.push({
            actor: "teacher",
            action: "grade.override",
            entityType: "AnswerGrade",
            entityId: `ag_${subId}_${q.number}`,
            details: JSON.stringify({ assessmentId: a.id, question: q.number, from: ans.aiMarks, to: ans.finalMarks, band: ans.band, note: ans.teacherNote }),
            createdAt: addDays(a.date, 2),
          });
        }
      }
    }
    if (a.graded) {
      audits.push({
        actor: "ai",
        action: "assessment.graded",
        entityType: "Assessment",
        entityId: a.id,
        details: JSON.stringify({ answers: a.submissions.reduce((s, x) => s + x.answers.length, 0), mode: "seed" }),
        createdAt: addDays(a.date, 1),
      });
      audits.push({ actor: "teacher", action: "assessment.finalised", entityType: "Assessment", entityId: a.id, details: "{}", createdAt: addDays(a.date, 3) });
    }
  }
  await chunked(submissions, 500, (data) => prisma.submission.createMany({ data }));
  await chunked(grades, 500, (data) => prisma.answerGrade.createMany({ data }));

  log("Flags…");
  for (const f of fx.flags) {
    const created = addDays(f.createdAt, 3);
    await prisma.flag.create({
      data: {
        id: `flag_${f.studentId.replace("stu_", "")}`,
        studentId: f.studentId,
        sectionId: f.sectionId,
        type: f.type,
        evidence: JSON.stringify(f.evidence),
        status: "open",
        history: JSON.stringify([{ status: "open", at: created.toISOString(), note: `Flagged automatically when ${f.evidence.trigger.title} was finalised.` }]),
        triggerAssessmentId: f.triggerAssessmentId,
        createdAt: created,
      },
    });
    audits.push({ actor: "system", action: "flag.created", entityType: "Flag", entityId: `flag_${f.studentId.replace("stu_", "")}`, details: JSON.stringify({ type: f.type }), createdAt: created });
  }
  await chunked(audits, 500, (data) => prisma.auditLog.createMany({ data }));
  log(`Done: ${STUDENTS.length} students, ${fx.assessments.length} assessments, ${grades.length} graded answers, ${fx.flags.length} flags.`);
  return { students: STUDENTS.length, assessments: fx.assessments.length, answers: grades.length, flags: fx.flags.length };
}

function gradeRow(subId: string, qId: string, rubric: { step: string; marks: number }[], conceptIds: string[], ans: GenAnswer, reviewedAt: Date) {
  const steps = rubric.map((r, i) => ({ step: r.step, marks: r.marks, awarded: ans.aiAwards[i] }));
  const teacherSteps = rubric.map((r, i) => ({ step: r.step, marks: r.marks, awarded: ans.finalAwards[i] }));
  return {
    id: `ag_${subId}_${qId.split("_").pop()}`,
    submissionId: subId,
    questionId: qId,
    transcription: ans.transcription,
    awardedMarks: ans.aiMarks,
    maxMarks: sum(rubric.map((r) => r.marks)),
    steps: JSON.stringify(steps),
    mistakeType: ans.mistakeType,
    misconception: ans.misconception,
    aiReasoning: ans.reasoning,
    conceptIds: JSON.stringify(conceptIds),
    confidence: ans.confidence,
    confidenceReasons: JSON.stringify(ans.reasons),
    signals: JSON.stringify(ans.signals),
    passes: JSON.stringify([
      { pass: "A", marks: ans.aiMarks },
      { pass: "B", marks: ans.passBMarks },
    ]),
    status: ans.status,
    teacherMarks: ans.status === "overridden" ? ans.finalMarks : null,
    teacherSteps: ans.status === "overridden" ? JSON.stringify(teacherSteps) : null,
    teacherNote: ans.teacherNote ?? null,
    reviewedAt,
  };
}
