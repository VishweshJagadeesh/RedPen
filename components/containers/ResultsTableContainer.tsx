"use client";
import { ResultsTable as ResultsTableView } from "@/components/grading/ResultsTable";
import type { ResultsData } from "@/lib/queries/review";

export function ResultsTable({ data, sectionId }: { data: ResultsData; sectionId: string }) {
  return (
    <ResultsTableView
      data={data}
      csvHref={`/api/assessments/${data.assessment.id}/results.csv`}
      reviewHref={`/assessments/${data.assessment.id}/review`}
      studentHref={(studentId) => `/sections/${sectionId}/students/${studentId}`}
    />
  );
}
