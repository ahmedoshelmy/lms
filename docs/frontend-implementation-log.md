# Frontend implementation log

One entry per task from [frontend-roadmap.md](frontend-roadmap.md), newest last.

How validation is run on Windows: tests from `I:\lms` (uppercase drive — see
[frontend-audit.md](frontend-audit.md)), builds with `CI=true npx ng build` when memory is
short.

Baseline (2026-11-24, `fae4016`): build passes, initial bundle 598.33 kB; 7 test files,
78 tests pass.

## P0-01 — Unmarked students are no longer saved as Present

- **What changed:** `markToApiStatus` has no default, so an unmarked child can't become
  Present. `buildRegisterPayload` returns nothing while anyone is unmarked, and the session
  page won't save until everyone is marked. The page shows "N not marked yet" (which jumps to
  them) and a "Not marked" filter pill. The per-student retry after a failed bulk save is
  gone.
- **Why:** finding C-01. A half-marked register was filed with every unmarked child as
  Present, and monthly reports are written from it. The retry fired one request per child
  after any error, including refusals, and dropped the task and assignment marks.
- **Files:** `core/utils/attendance.utils.ts` (+ spec);
  `features/sessions/session-detail/session-detail.component.{ts,html,scss}`.
- **Decision:** block rather than omit. An omitted child would later read as "not in the
  group" rather than "not marked".
- **Validation:** 8 files / 84 tests pass (6 new); production build passes; initial bundle
  unchanged at 598.33 kB.
- **Remaining:** `LmsService.createAttendance` / `updateAttendance` are now unused (kept for
  API stability). The `lms_attendance_*` cache is P0-10.

## P0-02 — A refused session edit no longer looks saved

- **What changed:** on error, the schedule's session panel and the session page now stop
  the spinner and keep the form open. They no longer apply the edit on screen or say
  "Session updated locally (server sync pending)".
- **Why:** finding C-04. Nothing ever synced, so staff acted on a class that hadn't moved.
- **Files:** `features/schedule/session-detail-panel/session-detail-panel.component.ts`
  (+ new spec); `features/sessions/session-detail/session-detail.component.ts`.
- **Validation:** 9 files / 86 tests pass. The new test fails against the old code (checked
  by stashing the fix) and passes with it. Build passes; initial bundle 598.33 kB.
- **Remaining:** the two copies of this save logic are still duplicated (F-09).
