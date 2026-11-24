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

## P0-03 — No default student password; the profile stops pretending to save

- **What changed:**
  - **Student form:** it now has a password field. A password is required to create a
    student and optional when editing ("leave blank to keep current"), like the instructor
    form. The `'pass2word'` fallback is gone.
  - **Profile page:** now read-only (name, email, phone, role), with a note to ask an
    administrator for changes. The Security and Preferences tabs, the forms behind them and
    their styles are removed. So is `AuthService.updateProfile`, whose only caller was the
    fake details save.
- **Why:** findings C-02 and C-03 / S-1 and S-3. The student form never asked for a password,
  so _every_ student created there had `pass2word`, which is worse than the audit stated.
  The profile's password change was a 600 ms timer and a success toast.
- **Files:** `features/students/students.component.{ts,html}` (+ new spec);
  `features/profile/profile.component.{ts,html,scss}`; `core/services/auth.service.ts`.
- **Validation:** 10 files / 88 tests pass. The new students test fails against the old code.
  Build passes; initial bundle 598.17 kB.
- **Backend dependency:**
  - Existing students still have `pass2word`. They need resetting; admins can now do that
    from the edit form.
  - The server should reject empty or weak passwords.
  - Self-service profile and password changes need endpoints.

## P0-04 — Schedule analytics counts real classes only

- **What changed:**
  - The tab, renamed "Week in numbers", is built from `summariseWeek` /
    `busiestAndQuietest`. Per day it shows classes, cancellations, instructors teaching and
    teaching hours, all counted from the loaded sessions.
  - The busiest day and the quietest day with classes are computed, and an empty week says
    so.
  - Removed: the hard-coded per-day figures, the "19 Sessions" / "15 Free" headlines, the
    floor of 4 instructors, the "9 hours × every instructor" capacity and free-slot columns,
    and the emojis.
  - The tab is now staff-only (`isStaff`), so students no longer see it.
- **Why:** finding C-05. On any day without sessions the tab showed invented numbers, to
  students too.
- **Decision:** capacity is not estimated here. It's an availability question, and the
  availability views answer it from declared hours.
- **Files:** `core/utils/week-summary.utils.ts` (+ spec);
  `features/schedule/components/schedule-analytics/schedule-analytics.component.ts`;
  `features/schedule/schedule.component.html`.
- **Validation:** 11 files / 93 tests pass (5 new); build passes; initial bundle 596.34 kB.

## P0-05 — Calendar dates are local dates

- **What changed:** new `core/utils/date.utils.ts` provides `toIsoDate`, `toIsoMonth`,
  `todayIsoDate` and `fromIsoDate`. `toIsoDate` moved there from `availability.utils.ts`
  (no other file imported it from the old place). Every `toISOString().slice/split`
  used as a calendar date was replaced, 13 sites in all: Sales trial dates and search start,
  availability defaults and summary month, group dates and the hold default, the standalone
  session date, the time-off range, and both session edit forms. Those two forms also read
  the date input as local midnight instead of UTC.
- **Why:** finding C-07. East of UTC, local midnight is the previous UTC day. Confirmed on
  this machine (Egypt Standard Time): before the fix, a Saturday hold offered
  **Friday 2026-11-27** as its next trial date.
- **Files:** `core/utils/date.utils.ts` (+ spec), `core/utils/availability.utils.ts`,
  `features/sales/sales.component.ts` (+ new spec), and the availability, groups, group
  detail, schedule, standalone-session dialog, session panel and session detail
  components.
- **Validation:** 13 files / 101 tests pass (8 new). The Sales test fails against the old
  code with exactly that Friday. Build passes.
- **Remaining:** the certificate dialog keeps its own correct helper (`localDateInputToIso`);
  merging it is F-08 tidy-up.

## P0-06 — Group detail stops changing things nobody asked it to

- **What changed (group detail, plus the groups list where noted):**
  - **Location:** no more "MOA" default (four places); the field starts empty.
  - **Course removal:** the curriculum tab's trash button no longer drops a saved course
    silently. It opens the existing Remove Course dialog, which lists the classes and
    registers that go with it, and the row leaves the list only after the server confirms.
    Rows added in the same edit and not yet saved still remove directly. The button now has
    an accessible name.
  - **End date (group detail and the groups list):** editing no longer requires an end date,
    which is display-only and derived from the last class. A group with no classes yet sends
    `endDate: null`, and `UpdateGroupPayload.endDate` is now typed `string | null`. Creating
    a group still asks for one.
  - **Garbled text:** 38 double-encoded lines restored (bullets, dashes, "·", "…", emojis)
    in group detail, `courses.component.html`, the standalone-session dialog and the
    `lms.service.ts` section comments. Fragments cut off part-way were dropped.
  - **Fake columns:** "Attendance" and "Progress" columns removed from the group's student
    table. They printed "Enrolled"/"Active" for every child and sorted on fields the API
    doesn't send.
  - **Course-sessions dialog:** shows a real first–last date range instead of
    `[object Object] - [object Object]`.
  - **Tidy-up:** removed the unused `RouterLink` import, the build's only Angular warning.
- **Why:** finding C-08, and the group-detail items in the audit's Admin/Operations section.
- **Files:** `features/groups/group-detail/group-detail.component.{ts,html}` (+ new spec),
  `features/groups/groups.component.ts`, `core/interfaces/Group.ts`,
  `core/services/lms.service.ts` (comments only), `features/courses/courses.component.html`,
  `features/schedule/components/create-standalone-session-dialog/…html`.
- **Validation:**
  - 14 files / 104 tests pass (3 new: no invented location, saving without an end date, a
    saved course goes to the removal dialog). Build passes with no Angular warnings;
    initial bundle 595.71 kB.
  - The "fails on the old code" check could not run here: with the old component restored,
    the new template binding no longer compiles. The old behaviour each test targets is
    visible in the diff.
- **Backend to verify:** the server accepts `endDate: null` on `PUT /groups/{id}`. It returns
  null for these groups, so the field should be nullable; if it isn't, the save is refused
  with a 400 and nothing is written, which is no worse than the blocked form.

## P0-07 — Destructive actions ask first; cancelling always asks why

- **What changed:**
  - **Shared confirmation:** `ConfirmService.ask()` returns a promise, and
    `ConfirmHostComponent` draws it once in the main layout using `p-dialog`. The safe
    button comes first and has focus. Escape or the close icon counts as "no", and a second
    question answers the first with "no".
  - **Sales:** cancelling the release-reason prompt no longer releases the hold. Removing a
    candidate asks first, and its icon button now has an accessible name.
  - **Session edit forms (panel and page):** saving a status of "Cancelled" on a running
    class opens the cancel dialog, which asks the cause and whether to shift, instead of
    filing the cancellation through the plain update. The rule lives in
    `isNewCancellation` (`cancellation.utils.ts`).
  - **Groups list:** "Move forward", "Generate N", "Mark completed" and "Set to N" are
    Admin-only (they call Admin-only endpoints) and ask first. Other roles see "Open".
- **Why:** finding C-09. The app had no shared confirmation pattern.
- **Decision:** this was first built on PrimeNG's `ConfirmDialog`, which pushed the initial
  bundle to 602.11 kB, over the 600 kB warning budget. A stats diff showed +5.5 kB of Angular
  core code pulled in by that one component. Rebuilt on `p-dialog`, which the app already
  uses, the bundle is back to 595.71 kB and the budget is unchanged.
- **Files:** `core/services/confirm.service.ts` (+ spec),
  `shared/components/confirm-host/confirm-host.component.ts` (+ render spec),
  `shared/layouts/main-layout/*`, `core/utils/cancellation.utils.ts` (+ spec),
  `features/sales/sales.component.{ts,html}` (+ spec),
  `features/groups/groups.component.{ts,html}`,
  `features/schedule/session-detail-panel/session-detail-panel.component.ts` (+ spec),
  `features/sessions/session-detail/session-detail.component.ts`.
- **Validation:** 16 files / 113 tests pass (9 new, including a render test of the dialog).
  Build passes with no warnings; initial bundle 595.71 kB.
- **Remaining:** `prompt()` for the release reason stays until W-01. Other destructive
  actions already had their own dialogs; moving them onto `ConfirmService` is D-03.
- **Note for CI (F-06):** `prettier --check` flags every file Git checks out with CRLF
  (`core.autocrlf=true` vs `endOfLine: lf`). It's a line-ending artefact, not formatting.
  Fix with a `.gitattributes` `* text=auto eol=lf`, or check with `--end-of-line auto`.

## P0-08 — Monthly report edits are no longer lost on release or navigation

- **What changed:**
  - "Release to parents" is disabled while there are unsaved edits, with a tooltip, and
    `release()` refuses as a backstop.
  - New reusable `unsavedChangesGuard` (`core/guards/unsaved-changes.guard.ts`, with a
    `HasUnsavedChanges` interface), added to the `evaluations/:studentId/:groupId` route. It
    asks "Leave without saving?" through `ConfirmService`. The report editor also warns on
    `beforeunload` (tab close or reload).
- **Why:** finding C-10. Releasing applied the stored copy over the screen and wiped
  anything typed since the last save, and nothing warned before leaving the editor.
- **Decision:** block rather than auto-save before release. Auto-save would mean choosing
  `save(true)` or `save(false)` for a report already sent to operations, and how the server
  treats each in that state isn't verified. Admins save ("Send to operations"), then
  release.
- **Files:** `core/guards/unsaved-changes.guard.ts` (+ spec), `app.routes.ts`,
  `features/evaluations/evaluation-detail/evaluation-detail.component.{ts,html}`.
- **Validation:** 17 files / 116 tests pass (3 new, guard). Build passes; initial bundle
  596.47 kB. The release block has no component test: it needs a full report fixture, and
  the rule is a direct guard plus a disabled button.
- **Remaining:** the register on `/sessions/:id` can lose unsaved marks the same way. The
  guard can be reused there (W-02).

## P0-09 — The outstanding-work window always has a way out

- **What changed:**
  - **Late registers for non-admins:** the window no longer offers "Mark the register",
    which opened a page locked for them. It says operations will fill the register in, and
    keeps "It didn't happen". Admins, who can take late registers, still get the button.
  - **"Close for now":** appears when everything left is out of the person's hands. It snoozes
    the window (`OperationsService.snoozed`) until reload or sign-out, and new actionable
    work brings it back.
  - **"Sign out":** always in the window's footer, since the window covers the sidebar.
  - **Wording:** the footer no longer promises that an instructor can take a register
    "however late it is". The panel uses `100dvh` so the footer stays on screen on phones.
- **Why:** finding C-06. An instructor with a late register was sent to a locked page, and
  any navigation brought the window back. The only way out was to claim a class that
  happened did not, and sign-out sat underneath the window.
- **Decision (yours):** frontend-only. The server rule is unchanged.
- **Files:** `shared/components/outstanding-work/outstanding-work.component.{ts,html,scss}`
  (+ new spec), `core/services/operations.service.ts`.
- **Validation:** 18 files / 121 tests pass (5 new, rendered). Against the old component the
  three trap tests fail and the two unchanged behaviours pass. Build passes.
- **Follow-up for you (backend question):** the window's original wording and the server's
  `late` flag ("it will be recorded as taken late") suggest the server _accepts_ late
  registers from the teaching instructor. The session page's lock dates from August, three
  months before the window. If the server does accept them, the lock is stale, and unlocking
  it for the teaching instructor (`isLocked` in `session-detail.component.ts`) would let the
  window work as first designed.
- **Remaining:** the window is still not a proper modal for keyboard users (focus is not
  moved into it or kept there) — A-02. Sign-out logic now exists in three places — F-01.

## P0-10 — Students no longer see the class list; no register copies in the browser

- **What changed:**
  - **Session page (`/sessions/:id`):** the attendance stats, class list and register
    controls show only to Admin and Instructor (`isStaff`). A student sees "Your attendance"
    with their own mark, or "Not marked yet".
  - **Attendance cache:** registers are no longer copied into `lms_attendance_*` in
    `localStorage` or merged back on load. `purgeLegacyAttendanceCache` deletes existing
    copies once at startup (in `AppComponent`'s `afterNextRender`, browser only). The
    Settings "Clear Cache" control, now pointless, is removed.
- **Why:** finding C-12 / S-6.
  - Students saw every classmate's name, email and mark, with active Save buttons.
  - The cache held student ids and marks indefinitely and survived sign-out.
  - Its only visible effect was to bring back students who had left the group as
    "Student #id" rows, which the next save then filed marks for.
- **Files:** `features/sessions/session-detail/session-detail.component.{ts,html}`
  (+ new spec), `core/utils/legacy-storage.utils.ts` (+ spec), `app.component.ts`,
  `features/settings/settings.component.ts`.
- **Validation:** 20 files / 124 tests pass (3 new). Against the old page the student test
  fails: the student saw a classmate's name and email. The instructor test passes on both
  versions. Build passes.
- **Backend dependency:** confirm the server refuses attendance writes from students and
  limits what `GET /Schedule/sessions/{id}` returns to them. Hiding it here is presentation
  only.
