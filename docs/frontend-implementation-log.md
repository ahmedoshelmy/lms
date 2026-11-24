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

## P0-11 — The API address is set at build time

- **What changed:**
  - New `src/environments/environment.ts` (production) and `environment.development.ts`,
    swapped in through `fileReplacements` in the `development` configuration of
    `angular.json`. Each holds `apiUrl` and `allowApiUrlOverride`.
  - New `core/config/api-url.ts` `resolveApiUrl()` is the single source, used by both
    `LmsService` and the auth interceptor; each used to hard-code the address and read
    `lms_api_url` separately. In a build that doesn't allow overrides it ignores and removes
    a saved address.
  - `LmsService.setApiUrl` does nothing in production. Settings shows the address read-only
    there and keeps the editor for development builds.
- **Why:** finding C-11 / S-2. Any role could change the API address at runtime in
  production, and the sign-in form and every token followed it.
- **Verified in the built bundle:** the production output contains
  `{production:!0, apiUrl:"https://mv-api.inite.tech/api", allowApiUrlOverride:!1}`.
- **Files:** `src/environments/*` (new), `angular.json`, `core/config/api-url.ts` (+ spec),
  `core/services/lms.service.ts`, `core/interceptors/auth.interceptor.ts`,
  `features/settings/settings.component.ts`.
- **Validation:** 21 files / 128 tests pass (4 new); production build passes; initial bundle
  596.83 kB.
- **Effect on users:** anyone whose production browser had a saved override now talks to
  the built-in API. That's the point, but say so if anyone relied on it for testing; they
  should use a development build.
- **Later (deployment):** to serve several environments from one Docker image, swap this
  for a runtime `config.json` served by nginx. Not needed while there is one API.

## SSR-01 — Unused server-side rendering removed

- **Confirmed unused before deleting:**
  - `angular.json` has no `server`, `ssr`, `outputMode` or `prerender` option, and the
    build produces only `browser/` with an empty `prerendered-routes.json`.
  - Both deployment targets are static: Docker → nginx (`.do/app.yaml`) and `vercel.json`.
  - Nothing outside the SSR files imports `@angular/ssr`, `@angular/platform-server` or
    `express`, and `tsconfig.server.json` isn't referenced by `tsconfig.json`.
  - The `serve:ssr:lms-platform` script pointed at a `server.mjs` the build never produced.
- **What changed:**
  - Deleted `src/server.ts`, `src/main.server.ts`, `src/app/app.config.server.ts`,
    `src/app/app.routes.server.ts` and `tsconfig.server.json`, plus the `serve:ssr` script.
  - `npm uninstall` removed `@angular/ssr`, `@angular/platform-server`, `express` and
    `@types/express`. The lockfile change is removals plus 66 `"dev": true` flags (express
    and friends remain for the dev server); no versions changed.
  - The SSR note in `AGENTS.md` now says the app is client-side only. Its platform-check
    advice stays, so SSR can come back without breakage.
- **Decision (yours):** delete once confirmed unused.
- **Validation:** build output and initial bundle unchanged (596.83 kB), which confirms none
  of it shipped. 21 files / 128 tests pass.
- **Effect on security:** production `npm audit` went from 16 advisories (1 critical) to
  11 (none critical). The critical `proxy-addr` came in through `express`.
- **Left alone:** the Dockerfile's `index.csr.html` copy step and nginx's
  `try_files … /index.csr.html` are harmless SSR-era leftovers; tidy them with R-01.
- **Recommended next (R-03):** the remaining production advisories are against the
  installed Angular 21.2.x itself, including an i18n XSS and a sanitizer bypass through host
  bindings. The current `^21.2.0` ranges already allow 21.2.26, so a patch update within the
  ranges, with a full test and build pass, should clear most of them.

## R-03 — Angular and tooling patched within 21.2.x (moved ahead of Phase 1)

- **What changed:**
  - Angular framework packages 21.2.17 → 21.2.26; `@angular/build` / `@angular/cli`
    21.2.15 → 21.2.31. Patch updates within range for Tailwind 4.3.5, PostCSS 8.5.33,
    PrimeNG 21.1.10, Vitest 4.1.12 and tslib 2.9.1, plus `npm audit fix` without `--force`.
  - Removed the unused `@angular/animations` (F-05). It pinned `@angular/core` to exactly
    21.2.17 and blocked the update.
  - Angular minimums in `package.json` raised to the patched versions (still `^21.2.x`).
  - To re-resolve the pinned Angular set, only the `@angular/*` lockfile entries were
    dropped and resolved again, not the whole lockfile.
  - Prettier was deliberately left at 3.8: a minor bump can reformat files and bury real
    changes.
- **Why:** after SSR-01, the 11 remaining production advisories were against Angular itself
  (i18n XSS, sanitizer bypass through host bindings, router DoS, HttpTransferCache).
- **Result:** `npm audit --omit=dev` finds **0 vulnerabilities** (16 at the audit). All
  dependencies: 17 low/moderate, all in build or dev tooling (esbuild, glob, minimatch;
  52 at the audit).
- **Lockfile review:** 113 versions changed, 37 added, 4 removed. Two major jumps
  (`@hono/node-server`, `content-disposition`) are both inside `@angular/cli`'s MCP SDK,
  dev-only, and chosen by the CLI.
- **Validation:** 21 files / 128 tests pass; production build clean; initial bundle
  596.93 kB.

## F-06 — Line endings, linting and CI

- **What changed:**
  - **Line endings:** `.gitattributes` keeps text files LF in every checkout (repository
    content was already LF). `prettier --check .` now passes across the whole repo; two
    drifted source files were reformatted, and two generated docs artefacts are in
    `.prettierignore`.
  - **ESLint 9** (flat config, `eslint.config.js`): `@eslint/js` + `typescript-eslint` +
    `angular-eslint` 21.4, with template and accessibility rules. **0 errors, 200
    warnings.** Each warning rule is known debt tied to a task: `no-explicit-any` (F-08),
    label association and keyboard support (A-03/A-04), old `*ngIf` (F-05). Each becomes an
    error when its task is done.
  - **Fixed to reach 0 errors:**
    - 21 unused imports and variables;
    - 3 ternaries used as statements;
    - `NotificationService` constructor injection changed to `inject()`;
    - an output named `close` (a DOM event name) renamed to `closed`;
    - an empty interface changed to a type alias.
  - **Deleted:** the dead `user-id.interceptor.ts` (moved forward from F-05).
  - **Rule options:** `!= null` is allowed in templates (deliberate null-or-undefined
    check). PrimeNG's `label` input counts as button content. The confirm dialog's
    `autofocus` on the safe button is allowed explicitly, with the reason.
  - **Scripts:** `lint` and `test:ci`.
  - **CI** (`.github/workflows/ci.yml`): Node 22 → `npm ci` → format check → lint → tests →
    production build, on every push and pull request.
- **Validation:** the same steps run locally all pass: lint 0 errors; 21 files / 128 tests;
  build clean at 596.89 kB.
- **Not verified:** the workflow hasn't run on GitHub; it runs on the first push.

## F-02 — One source of truth for permissions

- **What changed:**
  - **Guard:** `roleGuard` now denies a route with no roles; before, it let everyone in.
  - **`canAccessPath(role, path)`** in `app-navigation.config.ts`, plus
    `AuthService.canAccess(path)`: whether a role may open a path, read from
    `ROUTE_PERMISSIONS`. Unknown paths are refused.
  - **Command palette:**
    - its menu is built with `getMenuItemsForRole`, the same table as the sidebar, replacing
      its own hard-coded list (which sent Sales and students to refused pages, used different
      labels, and kept Settings admin-only);
    - students and groups load only for roles that can open them (`canAccess`);
    - a student result opens that student's page instead of the list.
  - **Links gated with `canAccess`:**
    - group detail: the instructor name, student names and the "view" icon are plain text
      for roles that can't open those pages (instructors used to land on "Access denied");
    - the schedule panel's "Take / View Attendance" link is hidden from students.
- **Why:** findings on fail-open guard and scattered role checks (audit §5 "Roles").
- **Tests (T-02, done here):** a guard spec (allow, deny, deny when no roles, signed-out
  redirect). A navigation spec checks that every route behind `roleGuard` has a
  `ROUTE_PERMISSIONS` entry with matching roles, that `canAccessPath` works for every path
  form, and that no role's menu offers a page that role would be refused.
- **Files:** `core/config/app-navigation.config.ts` (+ spec), `core/guards/role.guard.ts`
  (+ spec), `core/services/auth.service.ts`,
  `shared/components/command-palette/command-palette.component.ts`, group detail and
  schedule panel components (+ spec mocks).
- **Validation:** 23 files / 139 tests pass (11 new); lint 0 errors; build clean at
  597.01 kB.
- **Remaining:** component-level `isAdmin()` checks for _actions_ (as opposed to page
  access) stay as they are. They gate server-side admin operations, not routes.

## F-03 — The latest request wins

- **What changed:**
  - New `core/utils/latest-request.ts`: `latestRequest()` returns a `LatestRequest` whose
    `latest()` operator cancels the previous request of the same kind when a new one starts,
    and cancels on destroy.
  - **Applied to:**
    - schedule week and instructor loads;
    - availability's three per-instructor loads;
    - the session syllabus;
    - monthly reports by month;
    - history filters;
    - activity-log filters and paging;
    - register-compliance months;
    - the Sales slot search;
    - the main load on group, student and instructor detail.
  - The three detail pages' `paramMap` subscriptions now end with the page
    (`takeUntilDestroyed`). They used to stay subscribed after leaving.
- **Why:** finding C-14. Changing week, month or filter quickly let an older, slower
  response land last and overwrite the newer one.
- **Decision:** an operator inserted before each existing `.subscribe` rather than rewriting
  each screen as a stream. Callbacks and loading flags are unchanged, so the diff at each
  site is one line.
- **Files:** `core/utils/latest-request.ts` (+ spec, including the out-of-order case) and the
  eleven components above.
- **Validation:** 24 files / 142 tests pass; tsc clean for the app and specs; lint 0 errors;
  build clean at 597.01 kB.
- **Remaining:** typed search boxes don't debounce. Correctness is covered; fewer requests
  while typing is PF-04.

## F-04 — Consistent error handling

- **What changed:**
  - **Duplicate toasts:** 35 component toasts that repeated the error interceptor's message
    were removed; the interceptor already shows the server's own message. 22 `err`
    parameters left unused were caught by the new lint step and fixed. Validation, PDF,
    clipboard and logic messages were kept (21).
  - **Failures no longer look like empty data:** new shared `app-load-error`, a "Try again"
    state with `role="alert"`, used on:
    - group, student and instructor detail, which were blank on failure;
    - register compliance ("No classes were taught in …");
    - monthly reports ("Nothing to report on …");
    - Sales held slots and pipeline ("Nothing held yet" / "Nobody in the pipeline").

    My Learning and the student home page say the record couldn't be loaded, where they
    said "You are not in a group yet".

  - **Global `ErrorHandler`** (`core/errors/app-error-handler.ts`): logs every uncaught
    error and shows one notice per 5 s at most. It ignores `HttpErrorResponse`, which the
    interceptor reports. It's the hook for monitoring (R-02).

- **Why:** audit §5 Reliability and code quality; `AGENTS.md` forbids duplicate toasts.
- **Mistake caught on the way:** the scripted removal of the group-detail 409 `else` branch
  also removed the `if`'s closing brace. Found on review, fixed, and confirmed by the type
  check.
- **Validation:** 26 files / 146 tests pass (handler spec; a rendered instructor-detail test
  that a failed load shows the error state and "Try again" reloads the same id); lint 0
  errors; build clean at 597.51 kB.

## F-05 — Dead code and unused dependencies removed

Everything below was checked as unused before deletion.

- **Files:** `features/home/*` (never routed or imported), `shared/layouts/auth-layout/*`
  (never used). `core/interceptors/user-id.interceptor.ts` went earlier, in F-06.
- **Packages:** `ngx-toastr` (imported nowhere). `@angular/animations` went earlier, in R-03.
- **Group detail:**
  - three dialogs that nothing could open: Student Details (no opener), Delete Student and
    Edit Total Sessions (their openers had no callers);
  - the session-number override, whose opener had no caller and whose dialog wasn't in the
    template;
  - 25 members only those used. A script removed only members referenced nowhere else,
    re-checking after each pass.
- **Schedule:** the cancel-and-shift modal (opener never called) and its 8 members.
- **Dashboard styles:** 36 rule blocks for 36 class names used in no template or script,
  dynamic class bindings included (22.6 kB → 17.4 kB of source).
- **Templates:** all old `*ngIf`/`*ngFor` converted with Angular's own migration
  (`@angular/core:control-flow`). It also dropped `CommonModule` where unused; the build
  with `strictTemplates` confirms nothing needed was removed. `prefer-control-flow` is now
  a lint error.
- **Validation:** lint 0 errors (warnings 200 → 170); 26 files / 146 tests pass; build clean
  at 597.51 kB.

## F-07 — One school week; instructors matched by id

- **What changed:**
  - **School week:** new `core/utils/week.utils.ts` holds `SCHOOL_WEEK_STARTS_ON = 6`
    (Saturday), `startOfSchoolWeek` and `isSameSchoolWeek`. They replace:
    - the schedule's two Saturday calculations;
    - the session editors' Monday-based `getMonday` / `isSameWeek` (panel and page);
    - the attendance list's Sunday-based "this week".
  - **Instructor matching:**
    - by id in the schedule load filter, the attendance filter and all three matrices;
    - the weekly view's filter holds a name, so it uses an exact, case-insensitive match.

    All of these used to match by substring, so "Ali" matched "Alia".

- **Decision (made for you, easy to change):** the school week starts on **Saturday**, as
  the schedule has always shown it. Change `SCHOOL_WEEK_STARTS_ON` to switch it everywhere.
- **Why:** audit §5 Business logic. Moving a class from Saturday to the Monday of the same
  school week used to start the "future week" cancel-and-shift flow.
- **Validation:** 28 files / 151 tests pass (6 new). The Ali/Alia test fails against the
  old weekly view. Lint 0 errors; build clean.

## F-08 (+ T-03) — The API service encodes its queries and says what it returns

- **What changed:**
  - **Request tests first (T-03):** `lms.service.spec.ts` pins the exact method and URL
    (with query) of every query-building endpoint, written against the old hand-built
    strings.
  - **`HttpParams`:** all 16 hand-built query strings now go through one `query()` helper
    on top of `HttpParams`, so values are encoded. Each method keeps its own skip rules
    (`includeInactive=false` is still sent). The request tests pass unchanged, so the
    server gets exactly the same URLs.
  - **Encoding bug fixed:** a value containing `&` or a space used to split the query and
    invent parameters. A test now covers it; it failed on the old code.
  - **Types:**
    - `Observable<any>` is gone: the two generate endpoints return `{ message?: string }`
      (their callers read it), and the bulk register returns `unknown`;
    - the duplicate `BulkAttendanceItem` interface now comes from `interfaces/Attendance`,
      re-exported for existing imports.
- **Decision:** splitting `LmsService` into per-domain services is deferred to F-09. Done
  now it would touch every consumer without changing behaviour; it belongs with breaking up
  the large components that use it.
- **Validation:** 29 files / 158 tests pass (7 new); lint 0 errors; build clean at
  597.09 kB.

## F-01 — One sign-out routine; other tabs follow

- **What changed:**
  - **`SessionService`** (`core/services/session.service.ts`):
    - `signOut()` tells the server (`POST /auth/logout`), signs out locally and goes to
      `/login`. The sidebar, the "Access denied" page and the outstanding-work window all use
      it, replacing three copies.
    - It **watches the signed-in state**: whenever it turns off, for any reason, it empties
      the notification bell and the outstanding-work state. That covers the interceptor's
      session-expiry path, which used to leave both filled in for the next person.
    - **Cross-tab:** a `storage` listener. Another tab signing out signs this one out too,
      and another tab signing in as a different user reloads this one rather than mix two
      people's permissions.
  - `AUTH_STORAGE_KEY` is exported from `AuthService`. Unused injections and the unused
    `roleIcon` were removed from the sidebar and the unauthorized page.
- **Design note:** the first version had the interceptor call `SessionService`. That pulled
  the bell and operations services into the startup bundle (601.24 kB, over budget) and
  needed two sign-out paths. Watching the signed-in state instead leaves the interceptor
  unchanged and starts `SessionService` from the lazily loaded main layout. The bundle is
  back to 597.10 kB.
- **Held back (backend):** the access token still lives in `localStorage` (S-4). Moving it
  into memory relies on the refresh cookie to restore a session after reload, and I can't
  confirm from here that the cookie is `HttpOnly; Secure; SameSite` and sent cross-site.
  Confirm that and it's a small change.
- **Validation:** 30 files / 163 tests pass (5 new for `SessionService`; the window test was
  updated); lint 0 errors; build clean at 597.10 kB. One run had test workers killed by
  low machine memory (environmental); the rerun was clean.

## F-10 — `AGENTS.md` and README describe the project as it is

- **`AGENTS.md`:**
  - **Removed (wrong):** the `localStorage` fallbacks claim, the missing `progress` and
    `resources` features, the `auth-layout`, "defaults to the OS preference" (it defaults
    to light), the `@theme` claim, and a hex colour in the example that broke the
    document's own rule.
  - **Added:**
    - the real folder layout, environments, ESLint and CI;
    - the single permission table (deny by default) and `canAccess`, plus
      `unsavedChangesGuard`;
    - `HttpParams`, `latestRequest`, `app-load-error`, `ConfirmService`, `SessionService`;
    - the date and school-week utilities;
    - the commands `lint` and `test:ci`, and the Windows drive-letter note;
    - a rule that the checks stay green and fixes come with a failing-first test.
- **README:** replaced the CLI boilerplate with requirements, getting started, checks,
  deployment and links to the docs.

## Phase 1 audit

- **Checks, from a clean tree:** format ✔; lint 0 errors (167 warnings, all tracked debt);
  31 test files / 166 tests ✔; production build ✔ at 597.22 kB (budget 600); production
  `npm audit` finds 0 vulnerabilities.
- **Independent review** of the whole Phase 1 diff, by a reviewer given the code but not
  my reasoning: **no High or Medium problems.** It checked all 35 toast removals against
  the interceptor and `SILENT_STATUSES`, every deleted member, the control-flow migration,
  all 16 query rewrites, every `latestRequest` site, the permission table, `SessionService`
  and the week and id changes.
- **Acted on:**
  - the session page redirected silently when the API answered with an empty body; it now
    says "That class could not be found";
  - when a request never reaches the server (status 0) the interceptor now says "Could not
    reach the server…" instead of "Something went wrong" (`errorMessage`, with tests).
- **Accepted as intended:** Settings no longer appears in the production command palette,
  matching the sidebar, which already hid it there.
- **For the backend to confirm:** that `ScheduleSession.instructorId` is always set, since
  filters now match by id.
- **Environment note:** with low free memory, the full test run can lose workers to
  out-of-memory. Running by folder (`ng test --include 'src/app/core/**/*.spec.ts'`, etc.)
  works. CI on Linux is unaffected.
- **Phase 1 held back, by design:** F-09 (break up large components) waits for Phase 7's
  workflow tests. The token-in-memory part of F-01 waits for the backend's confirmation
  of the refresh cookie.

## D-01 — Colour tokens are Tailwind theme values; `dark:` follows the app's switch

- **What changed (`src/styles.css`):**
  - **Theme:** the light token block is a Tailwind `@theme static` block. Every token still
    exists as the same CSS variable, so all existing `var(--color-…)` uses keep working, and
    each one is now also a utility: `bg-surface`, `text-text-muted`, `border-border`, etc.
    The dark values stay plain CSS outside Tailwind's layers, so they still win.
  - **`dark:`:** `@custom-variant dark` ties the 28 `dark:` classes to `data-theme="dark"`.
    They used to follow the operating system, so an app in light mode on a dark OS showed
    dark-mode colours in places.
  - **Radius tokens:** `--radius-control` (10 px), `--radius-card` (16 px) and
    `--radius-pill`, giving `rounded-card` and friends.
  - **Font stack:** starts with `system-ui`. The `'Inter'` it used to name was never loaded,
    so screens already fell back to the system face.
  - **Cleanup:** removed `--color-role-badge-bg/-text`, which were defined twice in light
    mode (the second pair won).
- **Verified in the built CSS:** each token is emitted once for light (theme layer) and once
  for dark; `dark:` rules compile to `:where([data-theme=dark], [data-theme=dark] *)`.
- **Cost:** +2.5 kB raw (+0.1 kB compressed). Each `dark:` rule now carries its own
  `:where(…)` selector instead of sitting in one `@media` block. Initial bundle 599.69 kB,
  just under the 600 kB warning; D-05 replaces those palette classes and should win it back.
- **Validation:** format ✔; lint 0 errors; 31 files / 166 tests ✔ (run in batches; this
  machine is short of memory); build ✔.

## PF-05 (moved ahead) — The API client leaves the first download

- **What changed:** `AuthService.login()` now posts to `${resolveApiUrl()}/auth/login`
  itself, with `HttpClient`, instead of calling `LmsService.login()`, which is removed.
  `AuthService` is needed at startup by the route guards, so its dependency on `LmsService`
  put the whole API client (11.4 kB) and the slot-search helper in the initial bundle.
  Nothing else at startup imports `LmsService`.
- **Result:** initial bundle 601.59 kB → **589.81 kB**. That was 1.59 kB over the 600 kB
  budget with D-02's preset in place; it's now about 10 kB under.
- **Test:** `auth.service.spec.ts` checks login sends the same request (POST, cookies,
  body) and stores the user.
- **Validation:** 32 files / 167 tests ✔; lint 0 errors; format ✔; build ✔.

## D-02 — PrimeNG in the brand colours; off the deprecated theme package

- **What changed:**
  - **Preset:** new `core/config/prime-preset.ts` `LmsPreset`, i.e. Aura with:
    - the primary button colours (`color`, `contrastColor`, `hoverColor`, `activeColor`)
      bound to `var(--color-primary*)`, for light and dark;
    - a primary 50–950 tint scale running through the brand's own values, used for focus
      rings, selected rows and highlighted options.

    Stock Aura's primary was emerald, so PrimeNG buttons, focus rings, selections and
    checkboxes were green beside the navy brand.

  - **Package:** `@primeng/themes` (deprecated) is replaced by `@primeuix/themes` 2.0.3. It's
    the package `@primeng/themes` was wrapping, at the same version.
  - **No `definePreset()`:** the preset is built with plain object spreads. The helper's
    merge utilities cost 2.5 kB of startup code for three nested overrides.

- **Cost:** the new package's Aura entry is about 1.35 kB larger than the wrapper's, plus
  0.55 kB for the preset. That's why PF-05 was moved ahead.
- **Not yet verified visually:** PrimeNG controls will look navy/blue instead of green.
  It's checked in the Phase 2 audit.
- **Validation:** 32 files / 167 tests ✔; lint 0 errors; build ✔ at 589.81 kB.

## D-04 + D-05 — Dialogs fit phones; components use tokens, not colours

- **D-04, dialogs on phones** (`src/styles.css`, ≤ 640 px): every PrimeNG dialog becomes a
  full-width sheet along the bottom, with top corners rounded, `max-height: 92dvh` (the
  visible height) and the footer clear of the home indicator. One scoped rule instead of
  51 template edits; `!important` overrides the dialogs' inline widths.
- **D-05, palette classes:** all **328 Tailwind palette classes (99 distinct) in 19 files**
  were replaced with token utilities by a script with a reviewed mapping:
  - **Hue → meaning:** red/rose → `error`, amber/orange/yellow → `warning`, green/emerald/
    teal → `success`, blue/sky/indigo → `info`, violet/purple → `session-group`, grey/slate
    → the neutral text, border and surface tokens.
  - **Shade → token:** pale tints → `*-background` (keeping any opacity), mid → base,
    dark text → `*-foreground`, pale borders → base at 25 %.
  - **Solid fills** behind white text → new `--color-{error,success,warning,info}-solid`
    tokens, each ≥ 5:1 against white. The plain error red is 3.8:1. On hover, solid fills
    go to 85 % so the hover still shows.
  - **The 49 `dark:` palette classes were removed:** the tokens already switch with the
    theme.
- **D-05, literal colours:** all **44 literal colour values in 15 component files** became
  tokens:
  - white text on fills → `--color-primary-content`;
  - tinted shadows and focus rings → `color-mix()` from their token;
  - the sidebar's blue → its `--color-sidebar-item-active` token;
  - the notification badge → `--color-error-solid` (white on it is now readable);
  - a hover wash that was invisible on the light sidebar → `--color-sidebar-item-hover`;
  - `var(--x, #fallback)` fallbacks removed;
  - the mobile backdrop → a new `--color-scrim` token.

  Only neutral black shadows remain, which `AGENTS.md` allows.

- **Checked in the build:**
  - all 51 token classes the conversion introduced exist in the compiled CSS (Tailwind
    drops unknown classes silently);
  - token classes compile to live `var(--color-…)` references, so they follow dark mode.
    The one exception: Tailwind folds the value into arbitrary _shadow_ classes, so the
    login button's tinted shadow keeps its light tint in dark mode. Cosmetic.
- **Result:** initial bundle 589.81 → **583.33 kB**.
- **Not verified visually:** colours stay in the same families, but I can't sign in to look
  at the pages. They're checked against a running build in the Phase 2 audit.
- **Validation:** 32 files / 167 tests ✔; lint 0 errors; format ✔; build ✔.

## Phase 2 audit

- **Checks:** format ✔; lint 0 errors; 32 files / 171 tests ✔ (run in batches; machine short
  of memory); production build ✔ at 583.49 kB.
- **Visual check against a running build.**
  - **Method:** a development build served on localhost by a small static server, driven by
    headless Chrome over the DevTools protocol with a throwaway profile. The Chrome extension
    wasn't connected, and two dev servers already held ports 4200/4300 and weren't touched.
  - **Safety:** to see signed-in screens without signing in, the browser was given a
    placeholder admin user and pointed at an unreachable API (`http://127.0.0.1:9/api`).
    No request left the machine, and every load failed fast, which showed the error states.
  - **Looked at:** login light/dark, groups light/dark, the student dialog on desktop and
    phone, and the Sales pipeline in dark.
- **Confirmed working:** tokens in both themes, the brand shell, dark mode across the shell,
  the phone bottom-sheet dialog, the new password field, and `app-load-error` in dark.
- **Found and fixed:**
  1. **Toast storm:** one failed page load stacked ~10 identical "Failed to fetch" toasts.
     The interceptor now shows an identical message once per 4 s (`RepeatFilter`, tested).
  2. **Unreachable-server message hidden:** `fetch` failures carry the browser's own
     "Failed to fetch", and `errorMessage` preferred any message it found. Status 0 is now
     checked first (tested).
  3. **Desktop dialogs nearly full-width:** five components (students, student detail,
     instructors, instructor detail, the session panel) forced `max-width: 95vw !important`
     on every dialog, overriding each dialog's own `max-width`. This dates from when those
     pages were added. Removed; the "Add Student" dialog is back to 520 px.
  4. **Failed loads shown as empty lists** on Groups, Students, Instructors, Courses and
     Attendance (missed in F-04). They now show `app-load-error` with "Try again".
  5. **Login:** the logo was invisible in light mode (`bg-linear-to- br` typo), and the
     login error's colour class had a stray `]`. Both predate this work. Fixed.
- **Re-checked visually after the fixes:** login logo, groups error state with no toast
  stack, desktop dialog width.

## W-01 — Sales: no browser prompts, no double actions, own records first

- **What changed:**
  - **`ConfirmService.askText()`:** the shared dialog with an optional labelled text box
    (`input: { label, placeholder, required }`). It returns the trimmed text, or `null` when
    the person backs out, and the go-ahead stays disabled until a required box has text.
    It replaces the last two `window.prompt()` calls: the Sales release reason, and the
    Availability change reason (where a too-short reason used to be dropped silently and
    now gets a warning).
  - **Per-item busy state in Sales:** extend, release, trial outcome, status change and
    remove each claim their item for the length of the request, and that item's buttons
    are disabled meanwhile. Before, each extra click on "Extend" added another 14 days.
  - **Mine / Everyone's:** the Sales page loads holds and candidates with
    `mineOnly: true` for a salesperson and `false` for Admin, with a visible toggle
    (`aria-pressed`). It matches the Sales dashboard, which already showed each
    salesperson their own, and keeps families' phone numbers to the person dealing with
    them by default. Nothing is out of reach: one click shows everyone's.
- **Validation:** 33 files / 175 tests ✔ (new: extend fires once under triple-click; the
  release dialog's cancel stops; text box returns trimmed text, required gating, and its
  label). Lint 0 errors; build ✔ at 583.65 kB.
- **Backend to confirm:** that `mineOnly` filters on the server. The frontend can only ask.

## W-02 — Instructors see their own availability; the register asks before it is lost

- **What changed:**
  - **Availability matrix:** an instructor (who can't pick another instructor) sees their
    own week. The matrix used to fall through to the first instructor in the list, so an
    instructor saw a colleague's availability as if it were theirs (audit H5). The test
    fails against the old code.
  - **Register guard:** `SessionDetailComponent` implements `HasUnsavedChanges`, and
    `sessions/:id` has `unsavedChangesGuard`. Leaving with marks typed but not saved asks
    first, and closing or reloading the tab gets the browser's warning. Same guard as the
    monthly reports (P0-08).
- **Deferred to Phase 4 (mobile):** a "Today" view for instructors and taking the register
  inline from the session list. These are new features best designed with the phone layout
  in mind.
- **Validation:** 34 files / 178 tests ✔ (3 new); lint 0 errors; build ✔.

## W-03 — Bulk student actions finish, report, and touch only what is on screen

- **What changed:**
  - **`runBulk()`** (`core/utils/bulk.utils.ts`, tested): runs one request per item,
    4 at a time, never stops at the first failure, and answers with `succeeded` and
    `failed`. It replaces `forkJoin`, which gave up at the first error, left the page
    unreloaded and said nothing about which students were done.
  - **Bulk assign and bulk delete:**
    - always reload the list;
    - all succeeded → success message and the selection clears;
    - some failed → "8 of 10 students deleted. Not done: Omar, … — still selected, to try
      again", with only the failures left selected.
  - **Only what is visible:** bulk actions and every count in the bulk UI use
    `selectedVisible`, the selected students the current filters show. A selection kept
    across filter changes used to let "Delete 3 students" delete students no longer on
    screen.
  - **Phone preserved:** bulk assign sends each student's phone back unchanged. It used to
    leave it out of a replace-style update (audit item; server behaviour unverified).
- **Not done (backend):**
  - true bulk endpoints (one request instead of N);
  - a per-group sessions endpoint, so group pages stop loading the whole timetable.
- **Validation:** 35 files / 181 tests ✔ (new: `runBulk`; a deletion that acts only on
  visible rows and keeps the refused one selected). Lint 0 errors; build ✔ at 584.00 kB.

## W-04 — Students see every group they are in; staff views stay with staff

- **What changed:**
  - **My Learning:** progress and certificate rows cover every current group
    (`courses` flat-maps over `groups()`). It used to take `groups()[0]` only, so a student
    learning two things saw one, and couldn't reach the second certificate. The header names
    every group and instructor.
  - **Student home:** one progress panel per current group (`activeCourses`), plus the same
    header line.
  - **Schedule:** the Schedule Matrix, Daily Availability and Instructor Availability views
    are staff-only, like "Week in numbers". The availability data behind them is refused to
    students, so they only ever showed students empty grids. (The schedule already avoided
    requesting it for students.)
- **Validation:** 36 files / 182 tests ✔ (new: a student in two groups, plus one they left,
  sees exactly the two current groups' courses). Lint 0 errors; build ✔.

## W-05 — Monthly reports list: per-row actions; "save them all" holds its month

- **What changed:**
  - **Release / withdraw:** tracked per report (`releasing` is a set, `isReleasing(id)`).
    One id used to be shared by every row, so starting a second re-enabled the first
    row's buttons and allowed a double release.
  - **"Save them all":** takes the rows and the month once at the start, and stops if the
    page is left (a `DestroyRef` flag). It used to read the live month for each report, so
    changing month mid-run fetched the rest from the new month and mixed two months' PDFs.
    It also kept downloading in the background after the person left.
- **Validation:** 37 files / 183 tests ✔. The new test switches month mid-run and expects
  every report from the original month; it fails against the old code. Lint 0 errors;
  build ✔.

## W-06 — The dashboard asks only for what the role sees

- **What changed:** `DashboardComponent.ngOnInit` loads its four instructor-view requests
  (two schedule fetches, courses, attendance summary) only for the instructor view. Admin,
  Sales and Students each see their own overview component, which loads its own data.
  The four requests used to go out for every role and be discarded, and a refused one
  showed an error on that person's home page.
- **Validation:** 38 files / 187 tests ✔ (new: an instructor triggers the loads; Admin,
  Sales and Student send none). Lint 0 errors.
- **W-07 (certificates issued and recorded on the server):** not done. It needs a backend
  endpoint to record an issued certificate; the frontend only builds the PDF. Recorded as a
  backend dependency.

## Phase 3 audit

- **Checks:** format ✔; lint 0 errors (167 warnings, unchanged); 38 files / 190 tests ✔
  (run in batches); production build ✔ at 583.99 kB; production `npm audit` 0.
- **Visual check** (same localhost setup as the Phase 2 audit): the Sales scope toggle
  ("Everyone's" for Admin), and the release-slot dialog with its text box, on desktop
  (light) and as a phone sheet (dark). Both looked right.
  - For Phase 6: in dark mode the red action button has white text on a light red, which is
    low contrast.
- **Independent review** of the Phase 3 diff. Fixed, each with a test that fails without the
  fix:
  1. **Certificate named the wrong group (High, from W-04).** My Learning lists every
     group's courses, but the certificate still took the first group's name, id (in the
     serial) and weekly rate. Each course row now carries its own group.
  2. **"Leave without saving?" after deleting a class.** Marks typed before the delete
     triggered the new guard on the way out, and "Stay" kept a page for a class that no
     longer exists. A successful delete now clears the unsaved state.
  3. **Signing out with an unsaved register asked after the sign-out.** By then nothing can
     be saved, and "Stay" left a signed-out person on the page. The guard now lets the
     navigation through once nobody is signed in. Leaving the page, or closing the tab
     (`beforeunload`), still asks. A deliberate sign-out does not ask first; that needs a
     confirm step in the sign-out button, left for Phase 6 (A-02).
- **Fixed without a test:**
  4. **Sales Mine/Everyone's could show the wrong list:** a fast double toggle let the
     older answer land last. Holds and candidates loads now go through `latestRequest()`,
     as AGENTS.md asks for filter-driven loads.
  5. **Students: hidden selections were unreachable.** Once the filters hid every selected
     student, the toolbar vanished, and with it "Clear Selection". A later bulk action then
     cleared the hidden ones too. The toolbar now shows while anything is selected and says
     how many are hidden. The bulk buttons show only when some are visible. A bulk action
     unselects only what it finished, so failures and hidden students stay selected (the
     existing test was updated to match).
  6. **The text box in the confirm dialog** (release slot, propose week) now gets the
     focus, so the reason can be typed at once. Plain confirmations still open on the safe
     button. Checked in the browser.
- **Reviewed, nothing found:** the confirm host (resets between questions, resolves once,
  trims, null on cancel), Sales busy guards (always released), renamed members, the session
  guard with the outstanding-work window, dashboard role branches, students with no group
  or a group with no course, evaluations, and the availability matrix.
- **Unconfirmed, left as is:** bulk assign sends `email: ''` for a student without an email,
  as before this work. Whether the server accepts that is a backend question.

