# RedPen — handoff

This document is for whoever builds the scripted walkthrough next. Everything below works in mock mode
(`AI_MODE=mock`, no API key) from `npm run db:seed && npm run dev`.

## What's built

| Area | Status |
|---|---|
| Demo access | Landing page with **Continue as demo teacher** (cookie session). An empty database seeds itself on first sign-in. |
| 5.1 Grading | Mobile-first upload wizard: create assessment (photos/PDF of paper + key, or sample paper) → AI splits the paper into questions with step rubric and concept tags (editable table, confirm) → ordered bulk page upload (camera or files, client-side downscaling) with header detection, page grouping and student matching (confidence + reason; duplicates/unmatched blocked; absentees recorded) → grading pipeline (locate/crop, transcribe, two independent grading passes, mistake type, misconception, concept tags, confidence with reasons; injection-safe) → live progress screen (answers graded, per-band answer and sheet counts, pause/resume, retry) → review queue (Low → Medium → High, keyboard A/E/J/K, per-step override with note, illegible, needs re-scan with re-upload, bulk accept High with count + confirmation) → finalise (only when everything is reviewed) → results table (students × questions, totals, band filter, CSV). Every override and AI action is in the audit log. |
| 5.2 Diagnosis | Class dashboard (weak-concept cards with % affected, misconception counts, anonymised real snippets, *Plan a reteach* / *Assign practice to the group*; section trend; concept heatmap weakest-first; needs-attention list), student view (score trend vs class, concept mastery over time, assessments, alerts, actions), alerts (`sudden_drop` both rules, `missed_submissions`, `concept_regression`) each with a *Why flagged* panel (rules fired with numbers, scores before/after, chapter/concept/question breakdown, mistake mix, suggested action, history). |
| 5.3 Reteach planner | Inputs (period, resources, language EN/HI/mixed, note) → plan grounded in the class's misconceptions (objective, 2-question prerequisite check, hook → explanation (#1) → worked example → misconception (#2) → guided practice → exit ticket with minutes, board plan, peer pairs from mastery data with reshuffle/mentor swap, extension, 3–5 question exit ticket). Inline edit, reorder, regenerate one section. Teaching mode (one step at a time, large text, timer, board plan). Print view. Mark taught → exit ticket becomes an `exit_ticket` assessment → same grading flow → card shows mastery before → after. |
| 5.4 Remedial | Start from an alert, a weak-concept group or a student. 5–10 questions easier → harder, each tagged and citing the exact mistake (test, question, what was written; anonymised for groups). Review/edit/reorder/remove → assign (pending on the student's profile, alert → Action taken) → printable sheet per student with a personal "Why this sheet" → upload & grade through the same flow → alert moves to Improving/Resolved with the evidence. |
| 5.5 Profile & PTM | Parent profile at `/p/<token>` (public, read-only, noindex, no contact details or photos): grades over time, strengths, weak concepts, pending work. PTM mode (large text, laptop-facing): trend, 2–3 strengths, 2–3 focus areas in plain language, this term's story, 3 talking points incl. a home activity, EN/HI toggle, one-page print. Every statement links to its source test/question and only uses extracted facts. |
| 7 Evals | `npm run eval` and `/evals`: agreement, calibration, confidently-wrong, review load, tagging, robustness, injection, alert P/R, plan rubric (rules + AI judge in live), latency/cost, review-override stats. Dated markdown reports in `evals/reports/`. Mock runs are labelled. |
| Homework | `homework` assessment type graded through the same flow; feeds class-wide weak concepts (not test alerts); per-concept understanding and completion on the class page; "Grade a homework" prefills the wizard. Seeded HW1–HW3; 8B HW3 surfaces "Percentage increase and decrease". |
| Class page & notifications | KPI strip; weak-concept cards (homework-sourced ones badged); class trend with zoomed axis and Healthy/Critical/Poor bands and change call-outs, in a card decoupled from the scrolling alerts card; homework panel; Students tab (search by name/roll, filters, sort, sparkline, weakest concept, homework completion); Concept mastery tab (short horizontal labels, weak columns marked, chapter grouping, search, sort, weak-only filter). Weak-concept count badges next to each class in the sidebar; Home banner and weak-concept cards with View class / Plan a reteach. |
| Settings | Reset demo data, AI mode/models, thresholds, audit log, sign out. |
| Tests | Vitest: 45 unit tests (story numbers, confidence, planner, remedial, PTM, evals, schemas). Playwright: one happy path per flow plus the class page (`npm run e2e`). |

## Known limitations

- **Live mode was not exercised against the real API in this build environment** (no key available). The live code
  paths compile, their zod schemas are tested to convert to SDK structured-output formats, and they follow the
  documented SDK usage; run `AI_MODE=live npm run eval -- --sheets 10` with a key to validate before demoing live.
- Grading is driven by the progress screen (one short request per sheet). Leaving the page pauses grading; reopening
  resumes it. There is no background queue.
- Answer sheets must be photos (JPG/PNG/WebP). Question papers and keys may be PDFs (sent to the model as documents).
- Mock mode only "reads" the bundled sample sheets; other uploads get a Low-band placeholder grade that says so.
- Seeded history (July–October) has no scans, so review cards for those answers show "Scan not retained".
- In-browser optimistic review updates are queued; on a very slow connection the counter can lead the server briefly.
- Peer pairs pair each mentor (≥60%) with up to two learners (<50%); the rest are listed to sit with the teacher.
- Local file storage is ephemeral on Vercel — set `BLOB_READ_WRITE_TOKEN` for uploads in production. SQLite is for
  local development only; production needs Postgres.
- Single teacher, single school, demo cookie only (by design for review).
- Next.js dev mode shows its own "N" indicator in the corner; it is not part of the app (absent in `npm start`).

## Seeded IDs (stable across resets)

| What | ID |
|---|---|
| Section 8B | `sec_8b` (8A `sec_8a`, 9A `sec_9a`) |
| WT4 (ungraded) | `asm_8b_wt4` |
| Periodic Test 1, 8B | `asm_8b_pt1` |
| Rohan / Sneha / Imran | `stu_8b_36` / `stu_8b_43` / `stu_8b_17` |
| Their alerts | `flag_8b_36` / `flag_8b_43` / `flag_8b_17` |
| Messy Low answer (Meera Q4, after grading) | `ag_sub_asm_8b_wt4_8b_25_4` |
| Injection answer (Kabir Q5, after grading) | `ag_sub_asm_8b_wt4_8b_21_5` |
| Concept "Transposing terms" | `c8-le-transposing` |

Useful endpoints for a script: `POST /api/settings/reset` (restore seed), `POST /api/assessments/asm_8b_wt4/grade`
(grade the next sheet; returns progress), `POST /api/assessments/<id>/accept-high`, `POST /api/assessments/<id>/finalise`.
`MOCK_LATENCY_MS` controls the per-sheet delay in mock mode (0 for instant, ~120–250 for a visible progress bar).

## Where each flow's components live

Presentational components are pure (props only, no fetching); containers in `components/containers/` fetch/act and
render them. All are exported from `components/index.ts`.

### Flow 1 — grade and review

| Screen | Route | Container | Presentational |
|---|---|---|---|
| Home (to-do) | `/dashboard` | `app/(app)/dashboard/page.tsx` | `TeacherHome` |
| New assessment | `/assessments/new` | `NewAssessmentContainer` | `UploadWizard`, `AssessmentDetailsForm` |
| Questions / sheets / matching | `/assessments/[id]` | `AssessmentWizardContainer` | `UploadWizard`, `QuestionConfirmTable`, `SheetUploader`, `SheetMatcher` |
| Progress | `/assessments/[id]/grade` | `GradingProgressContainer` | `GradingProgress` |
| Review | `/assessments/[id]/review` | `ReviewQueueContainer` | `ReviewQueue`, `AnswerReviewCard`, `HandwritingCrop`, `ConfidenceBadge`, `AiSuggestedTag` |
| Results | `/assessments/[id]/results` | `ResultsTableContainer` | `ResultsTable` |

### Flow 2 — weak concept → reteach plan → exit ticket

| Screen | Route | Container | Presentational |
|---|---|---|---|
| Class dashboard | `/sections/[id]` | `app/(app)/sections/[id]/page.tsx` | `ClassDashboard`, `WeakConceptCard`, `ClassTrendChart`, `StudentRoster`, `ClassConceptHeatmap`, `FlaggedStudentsList` |
| Plan setup | `/reteach/new?sectionId&conceptId` | `ReteachSetupContainer` | `EvidenceSummary`, `ReteachInputsForm` |
| Plan editor | `/reteach/[id]` | `ReteachPlanContainer` | `ReteachPlanEditor` |
| Teaching mode | `/reteach/[id]/teach` | page | `TeachingMode` |
| Print | `/reteach/[id]/print` | page | `PrintablePlan` |
| Exit ticket grading | `/assessments/[id]` → grade → review | (flow 1 containers) | (flow 1 components) |

### Flow 3 — flag → remedial → regrade

| Screen | Route | Container | Presentational |
|---|---|---|---|
| Needs attention | `/alerts` | page | `FlaggedStudentsList` |
| Why flagged | `/alerts/[flagId]` | `WhyFlaggedContainer` | `WhyFlaggedPanel` |
| Build | `/remedial/new?flagId=…` (or `?sectionId&conceptId&group=weak`, `?sectionId&studentIds=`) | `RemedialNewContainer` | `RemedialBuilder` |
| Review / assign | `/remedial/[id]` | `RemedialReviewContainer` | `RemedialBuilder` |
| Print | `/remedial/[id]/print` | page | `PrintableRemedialSheet` |
| Grade submissions | `/assessments/[id]` → grade → review | (flow 1) | (flow 1) |

### Flow 4 — PTM view

| Screen | Route | Container | Presentational |
|---|---|---|---|
| Student view | `/sections/[sid]/students/[id]` | page | `StudentDetail` |
| PTM mode | `/students/[id]/ptm` (`?lang=hi`) | page | `PtmSummary` |
| Parent profile | `/p/[token]` | page | `StudentProfile` |

Other: `EvalReportView` (`/evals`), `SettingsPanel` (`/settings`), `AppShell`, `EmptyState`/`ErrorState`/`LoadingState`.

## `data-demo-id`s by flow

Dynamic parts are shown in `<angle brackets>`.

### Shared / navigation
`nav-weak-badge-<8A|8B|9A>` (class-wide weak concept count), `weak-concepts-banner`, `home-weak-concepts`,
`home-weak-<section>-<conceptId>`, `home-weak-view-class`, `home-weak-plan-reteach`, `section-card-weak-<section>`,
`continue-demo-teacher`, `logo`, `mobile-menu`, `mock-mode-badge`, `teacher-name`, `nav-home`, `nav-assessments`,
`nav-alerts`, `nav-remedial`, `nav-evals`, `nav-settings`, `nav-section-<8A|8B|9A>`, `section-card-<8A|8B|9A>`,
`home-flag-<flagId>`, `todo-<assessmentId>`, `empty-state`, `error-state`, `loading-state`.

### Flow 1 — grade and review
- Wizard: `upload-wizard` (has `data-step`), `wizard-step-<details|questions|sheets|match|grade>`, `assessment-status`,
  `new-assessment`, `assessment-row-<id>`, `use-sample-paper-c8-wt4`, `assessment-section`, `assessment-type`,
  `assessment-title`, `assessment-date`, `upload-paper-camera`, `upload-paper-files`, `upload-key-camera`,
  `upload-key-files`, `create-assessment`, `parse-paper`, `reparse-paper`, `question-row-<n>`, `question-text-<n>`,
  `question-concept-<n>`, `confirm-questions`, `capture-sheets`, `upload-sheets`, `use-sample-sheets`,
  `upload-progress`, `upload-summary`, `match-summary`, `match-row-<submissionId>`, `match-select-<submissionId>`,
  `confirm-matches` (label becomes "Start grading" once matches are confirmed), `start-grading-link`, `open-grading`,
  `open-review`, `open-results`.
- Progress: `grading-progress`, `answers-graded-count`, `sheets-graded-count`, `band-count-<high|medium|low>`,
  `start-grading`, `pause-grading`, `retry-sheet-<submissionId>`, `go-to-review`.
- Review: `review-queue`, `reviewed-count`, `accept-all-high`, `accept-high-dialog`, `confirm-accept-high`,
  `finalise-assessment`, `finalise-notes`, `view-results`, `filter-needs-review`, `filter-pending`, `filter-all`,
  `queue-item-<gradeId>`, `answer-review-card` (has `data-band`, `data-grade-id`), `review-student`, `handwriting-crop`,
  `review-transcription`, `review-marks`, `review-reasoning`, `confidence-reasons`, `accept-answer`, `edit-answer`,
  `step-input-<step>`, `override-note`, `save-override`, `mark-illegible`, `mark-rescan`, `prev-answer`, `next-answer`.
- Results: `results-table`, `results-filter-<all|low|medium|high>`, `results-row-<roll>`, `export-csv`.

### Flow 2 — weak concept → reteach → exit ticket
- Class page: `kpi-students`, `kpi-latest-average`, `kpi-weak-concepts`, `kpi-open-flags`, `kpi-homework`,
  `section-trend-card`, `class-health`, `needs-attention-card`, `homework-list`, `homework-<assessmentId>`,
  `grade-homework`, `weak-concept-from-homework`, `tab-students`, `tab-heatmap`, `student-roster`, `student-search`,
  `roster-count`, `roster-filter-<all|attention|weak|homework>`, `roster-sort`, `roster-row-<roll>`, `heatmap-search`,
  `heatmap-group-chapter`, `heatmap-only-weak`, `heatmap-sort`.
- Dashboard: `class-dashboard`, `weak-concept-card-<conceptId>`, `weak-concept-affected`,
  `weak-concept-misconceptions`, `weak-concept-snippet-<i>`, `plan-reteach`, `assign-group-practice`,
  `reteach-outcome`, `mastery-before-after`, `section-trend`, `class-concept-heatmap`, `heatmap-concept-<conceptId>`,
  `heatmap-row-<roll>`.
- Setup: `plan-evidence`, `reteach-period`, `reteach-resources`, `reteach-language`, `reteach-note`, `generate-plan`.
- Editor: `reteach-plan-editor`, `plan-status`, `plan-time-budget`, `open-teaching-mode`, `print-plan`, `save-plan`,
  `mark-plan-ready`, `taught-date`, `mark-plan-taught`, `create-exit-ticket`, `open-exit-ticket`,
  `plan-section-<kind>` (has `data-section-id`), `cites-<kind>`, `edit-section-<kind>`, `section-body-<kind>`,
  `regenerate-<kind>`, `move-up-<kind>`, `move-down-<kind>`, `peer-pairs`, `reshuffle-pairs`. Kinds: `objective`,
  `prerequisite_check`, `hook`, `explanation`, `worked_example`, `misconception`, `guided_practice`,
  `exit_ticket_step`, `board_plan`, `peer_pairs`, `extension`, `exit_ticket`.
- Teaching mode: `teaching-mode`, `teaching-step-title`, `teaching-step-body`, `step-timer`, `toggle-timer`,
  `prev-step`, `next-step`, `toggle-board-plan`, `teaching-board-plan`, `exit-teaching-mode`.
- Print: `printable-plan`, `print-now`.

### Flow 3 — flag → remedial → regrade
- Alerts: `alerts-tab-active`, `alerts-tab-resolved`, `flagged-students-list`, `flag-row-<first-last>` (e.g.
  `flag-row-rohan-kumar`).
- Why flagged: `why-flagged-panel`, `flag-status`, `flag-summary`, `flag-rules`, `flag-scores`, `flag-missed`,
  `flag-mistake-mix`, `flag-chapters`, `flag-concepts`, `flag-questions`, `flag-suggested-action`, `flag-note`,
  `create-remedial-from-flag`, `mark-action-taken`, `resolve-flag`, `reopen-flag`, `flag-history`.
- Builder: `remedial-builder`, `remedial-students`, `remedial-student-<roll>`, `remedial-concepts`,
  `remedial-concept-<conceptId>` (has `data-state`), `remedial-count`, `remedial-mode`, `generate-remedial`,
  `remedial-question-<n>`, `remedial-question-text-<n>`, `targets-mistake-<n>`, `remove-remedial-question-<n>`,
  `save-remedial`, `assign-remedial`, `print-remedial`, `upload-remedial-submissions`.
- Print: `printable-sheet-<roll>`, `print-now`. Then flow 1 ids for grading and review.

### Flow 4 — PTM
- Student view: `student-detail`, `student-trend`, `student-concepts`, `open-ptm`, `open-parent-profile`,
  `new-remedial-for-student`.
- PTM: `ptm-summary` (has `data-lang`), `ptm-student-name`, `ptm-trend`, `ptm-strengths`, `ptm-focus`, `ptm-term`,
  `ptm-talking-points`, `ptm-language-toggle`, `ptm-print`.
- Parent profile: `student-profile`, `profile-trend`, `profile-strengths`, `profile-weak-concepts`, `profile-pending`.

### Evals and settings
`eval-report`, `eval-mode`, `eval-exact`, `eval-confidently-wrong`, `eval-review-load`, `eval-flags`,
`eval-injection`, `eval-plan`, `eval-agreement`, `run-mock-eval`, `settings-panel`, `settings-ai-mode`,
`reset-demo-data`, `confirm-reset`, `sign-out`, `audit-log`.

## Notes for the scripted walkthrough

- `ClassConceptHeatmap` and `StudentRoster` take `studentHrefBase` (a string prefix) rather than a function, so they
  can be rendered from server components.
- Each presentational component can be rendered with fixture props alone; the containers show exactly which props
  and callbacks they need.
- The e2e specs in `tests/e2e/` are working scripts for all four flows and show reliable selectors and waits.
  `clickUntil` in `tests/e2e/helpers.ts` guards against clicking server-rendered buttons before hydration.
- Story numbers are asserted in `tests/unit/fixtures.test.ts`; if you change fixtures, run `npm test` and
  `npm run samples:generate` (images and gold set) together.
