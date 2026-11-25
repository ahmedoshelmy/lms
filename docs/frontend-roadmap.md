# Frontend roadmap

Built from [frontend-audit.md](frontend-audit.md). Progress is recorded in
[frontend-implementation-log.md](frontend-implementation-log.md).

Priorities: P0 critical, P1 high, P2 medium, P3 low. Sizes: XS < ½ day, S ½–1 day,
M 1–3 days, L 3–5 days, XL > 5 days. Sizes are estimates.

## Decisions taken (2026-11-24)

| Question                                                      | Decision                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0                                                       | Approved in full.                                                                                                                          |
| Outstanding-work window vs. the 24-hour register lock (P0-09) | Frontend-only: the window gives a way out (sign-out, and an honest route for a register that is now locked). The server rule is unchanged. |
| Profile page (P0-03)                                          | Hide what does not save until backend endpoints exist.                                                                                     |
| SSR scaffolding                                               | Delete it, once confirmed unused.                                                                                                          |

Still open: a separate Operations role; the school week's first day; new tooling (ESLint,
CI, Playwright, axe, an error monitor); one deployment target; brand icon artwork;
Arabic/RTL.

## Status (2026-11-24)

Each phase is on its own branch, cut from the one before (`frontend/phase-0` …
`frontend/phase-5`), one commit per task, and each phase ends with an audit. Details are in
the implementation log.

- **Phase 0:** P0-01 to P0-11 and SSR-01, done.
- **Phase 1:** R-03, F-01 to F-08 and F-10, done and audited. F-09 (splitting the largest
  components) is deferred until Phase 7 has tests around them.
- **Phase 2:** D-01, D-02, D-04 and D-05, done and audited. D-03 (shared page header and
  empty state) is adopted page by page as later phases touch them.
- **Phase 3:** W-01 to W-06, done and audited. W-07 needs a backend endpoint.
- **Phase 4:** M-01 to M-03, done and audited. Dark-mode contrast of primary-coloured text
  (101 uses) is handed to Phase 6 (A-04).
- **Phase 5:** PF-01 to PF-04 done and audited (PF-05 was done in Phase 2). All components are
  `OnPush`. The group page's session feed and Attendance's all-time list wait on backend
  queries (per group; paging).
- **Phase 7:** T-01 to T-03 were in place. T-04 (workflow tests for the register, the
  monthly report, the group page and sales) and T-05 (Playwright end to end, axe, desktop and
  phone) are done, and CI runs both. F-09 (splitting the largest components) is next, now that
  they have tests around them.
- **Phase 6:** A-01 to A-04, done and audited. Page titles, skip link, page announcements,
  modal focus, links instead of clickable boxes, labelled fields and named buttons, and
  token-level contrast in both themes. The label and keyboard lint rules are errors again.

Latest validation (Phase 6 audit): format ✔, lint 0 errors (42 warnings, all
`no-explicit-any`, F-08), 51 test files and 237 tests passing, production build ✔ with the
initial bundle at 588 kB against the 600 kB budget.

Backend questions still open:

- **Adding a student to a group** sends `PUT /users/{id}` with one `groupId`. A student can
  be in several groups: does that add the group, or replace the others?
- **Instructor KPIs:** the endpoints in `docs/instructor-kpis.api.md`. The screens are built
  and tested against that contract, and switched off in production
  (`environment.features.instructorKpis`) until the endpoints exist.
- Does `PUT /groups/{id}` accept `endDate: null`?
- Does the server accept late registers from the instructor who taught the class? If so,
  the session page's lock is stale.
- Does the server refuse attendance writes from students, and limit what they can read?
- Can students created with `pass2word` be forced to reset?
- Endpoints for profile edits and password change.
- Refresh-cookie flags, before the access token moves into memory.
- Does `mineOnly` filter on the server for holds and candidates?
- Bulk and per-group endpoints, instead of one request per student.
- Recording issued certificates (W-07); `instructorId` always set on sessions.
- A per-group session query; paging for the all-time session list; whether `GET /schedule`
  with only `from` has a default end.

## Task table

| ID     | Phase | Task                                                                                                                      | Priority | Size | Depends on                     |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------ |
| P0-01  | 0     | Unmarked students never saved as Present; no per-student flood fallback                                                   | P0       | S    | –                              |
| P0-02  | 0     | Failed session edits show an error, not "updated locally"                                                                 | P0       | XS   | –                              |
| P0-03  | 0     | Remove the default password; hide profile features that do not save                                                       | P0       | XS   | Backend for the real endpoints |
| P0-04  | 0     | Remove the invented analytics figures                                                                                     | P0       | S    | –                              |
| P0-05  | 0     | One local-date helper; fix every `toISOString()` calendar date                                                            | P0       | S    | –                              |
| P0-06  | 0     | Group detail: "MOA" default, course-removal bypass, end-date block, garbled text, fake columns, `[object Object]`         | P0       | M    | –                              |
| P0-07  | 0     | Shared confirmation; hold release on Cancel; cancellation only through the cancel flow; gate groups-list schedule actions | P0       | M    | –                              |
| P0-08  | 0     | Monthly report: save before release; unsaved-changes guard                                                                | P0       | S    | –                              |
| P0-09  | 0     | Outstanding-work window always has a way out                                                                              | P0       | S    | –                              |
| P0-10  | 0     | Hide the class list from students; remove the attendance cache                                                            | P0       | S    | Backend verification           |
| P0-11  | 0     | Build-time API address; Settings override development-only                                                                | P0       | S    | –                              |
| SSR-01 | 1     | Confirm SSR is unused, then delete it and its dependencies                                                                | P2       | S    | –                              |
| F-01   | 1     | One sign-out routine, cross-tab sync, token in memory                                                                     | P1       | M    | P0-11, backend                 |
| F-02   | 1     | Deny-by-default guard; one permission source; command palette from the route table                                        | P1       | M    | –                              |
| F-03   | 1     | "Latest request wins" on filter- and route-driven loads                                                                   | P1       | M    | –                              |
| F-04   | 1     | Drop duplicate toasts; page error states; global error handler                                                            | P1       | M    | D-03                           |
| F-05   | 1     | Remove dead code and unused dependencies                                                                                  | P2       | S    | –                              |
| F-06   | 1     | ESLint + CI (format, lint, test, build)                                                                                   | P1       | S    | Tooling decision               |
| F-07   | 1     | One school-week definition; instructor matching by ID                                                                     | P1       | S    | Week decision                  |
| F-08   | 1     | Split `LmsService` by domain behind a facade; `HttpParams`; typed responses                                               | P2       | M    | –                              |
| F-09   | 1     | Break up group detail, sales and session detail                                                                           | P2       | XL   | T-03, T-04                     |
| F-10   | 1     | Bring `AGENTS.md` and README up to date                                                                                   | P2       | XS   | –                              |
| D-01   | 2     | Tokens into Tailwind `@theme`; spacing/type/radius tokens; dark variant; load Inter                                       | P1       | M    | –                              |
| D-02   | 2     | PrimeNG preset from tokens; `@primeuix/themes`                                                                            | P2       | S    | D-01                           |
| D-03   | 2     | Shared header, empty/error states, badge, confirm, data list                                                              | P1       | M    | D-01                           |
| D-04   | 2     | Dialog standard (full-screen on phones)                                                                                   | P2       | S    | D-03                           |
| D-05   | 2     | Replace palette classes and literal colours, feature by feature                                                           | P2       | L    | D-01                           |
| W-01   | 3     | Sales: scoping, in-flight guards, error states, no `prompt()`                                                             | P1       | M    | P0-07                          |
| W-02   | 3     | Instructor: inline register, availability defaults to self, Today view                                                    | P1       | M    | P0-09                          |
| W-03   | 3     | Admin: bulk actions with failure summary; per-group session queries                                                       | P1       | L    | Backend                        |
| W-04   | 3     | Student: several groups; hide staff tabs                                                                                  | P2       | M    | –                              |
| W-05   | 3     | Reports: per-row busy state; bulk PDF captures the month and stops on leave                                               | P2       | S    | –                              |
| W-06   | 3     | Dashboard loads only the active role's data                                                                               | P2       | S    | –                              |
| W-07   | 3     | Certificates issued and recorded on the server                                                                            | P2       | M    | Backend                        |
| M-01   | 4     | Shell: drawer focus/Escape, no flash, `dvh`, safe areas                                                                   | P1       | S    | –                              |
| M-02   | 4     | Card fallbacks, grid fixes, filter drawer                                                                                 | P1       | M    | D-03                           |
| M-03   | 4     | Touch targets, wrapping headers, no hover-only controls                                                                   | P2       | M    | –                              |
| PF-01  | 5     | Lazy command palette and dialogs; bounded schedule queries; light health check                                            | P1       | S    | –                              |
| PF-02  | 5     | `OnPush` rollout                                                                                                          | P2       | M    | F-03                           |
| PF-03  | 5     | Precompute matrix data; correct booked hours                                                                              | P2       | M    | –                              |
| PF-04  | 5     | Reference-data cache                                                                                                      | P2       | M    | F-08                           |
| PF-05  | 5     | Bundle budget headroom (initial bundle is 598 / 600 kB)                                                                   | P1       | S    | PF-01, F-05                    |
| A-01   | 6     | Page titles, skip link, `aria-current`                                                                                    | P1       | XS   | –                              |
| A-02   | 6     | Proper modal behaviour for the three custom modals                                                                        | P1       | S    | –                              |
| A-03   | 6     | Clickable rows become buttons/links; sortable header semantics                                                            | P1       | M    | –                              |
| A-04   | 6     | Labels, icon-button names, announced errors, no colour-only status                                                        | P2       | M    | D-01                           |
| T-01   | 7     | Existing tests in CI                                                                                                      | P1       | XS   | F-06                           |
| T-02   | 7     | Role-matrix tests                                                                                                         | P1       | S    | F-02                           |
| T-03   | 7     | `LmsService` request tests                                                                                                | P2       | M    | –                              |
| T-04   | 7     | Workflow component tests                                                                                                  | P1       | L    | –                              |
| T-05   | 7     | Playwright end-to-end + axe + viewports                                                                                   | P2       | L    | Tooling decision               |
| PWA-01 | 8     | Manifest, icons, shell-only service worker, nginx config                                                                  | P2       | S    | P0-11, F-01, R-01              |
| PWA-02 | 8     | Update prompt, offline banner and page                                                                                    | P2       | S    | PWA-01                         |
| PWA-03 | 8     | Install experience                                                                                                        | P3       | S    | PWA-01                         |
| PWA-04 | 8     | Optional read-only offline week for instructors                                                                           | P3       | L    | Security sign-off              |
| R-01   | 9     | nginx security headers, caching, compression                                                                              | P1       | S    | Infrastructure                 |
| R-02   | 9     | Error monitoring                                                                                                          | P2       | S    | Decision                       |
| R-03   | 9     | Dependency hygiene                                                                                                        | P2       | S    | SSR-01                         |
| R-04   | 9     | One deployment target                                                                                                     | P3       | XS   | Decision                       |

## Sequence

1. Phase 0 — bugs that write wrong data or say something untrue.
2. CI, linting and one permission source, so later work has a safety net.
3. Sign-out, request cancellation, error states — the PWA depends on them.
4. Design tokens before any restyling, so features are restyled once.
5. Role workflows and mobile together, feature by feature.
6. Performance and accessibility folded into each feature, then a sweep.
7. PWA last among the large items.
