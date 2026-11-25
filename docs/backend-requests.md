# What the frontend needs from the backend

Everything the frontend work has found that only the server can do or answer, in one
place. Each item says why it matters and what the frontend does meanwhile. Contracts
are in `docs/*.api.md`.

## 1. To build

| #   | What                                                                                                                                                                                                  | Contract                      | Frontend meanwhile                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| B-1 | **Instructor KPIs:** monthly figures per instructor, admin adjustments with reasons, approve and reopen a month, settings, history, "send to owner" by email, and an instructor's own approved months | `docs/instructor-kpis.api.md` | Built and tested against the contract; switched off in production (`environment.features.instructorKpis`) |
| B-2 | **Client error reports:** `POST /client-errors`, no authentication, rate-limited, no personal data stored                                                                                             | `docs/client-errors.api.md`   | Built; off until `environment.errorReportUrl` is set                                                      |
| B-3 | **Recording issued certificates (W-07):** store each certificate issued (student, group, course level, date, serial) so a serial can be checked and not reissued                                      | to agree                      | Certificates are generated in the browser and not recorded                                                |
| B-4 | **Profile edit and password change** for the signed-in user                                                                                                                                           | to agree                      | The profile page hides those parts rather than pretend                                                    |
| B-5 | **Sessions for one group:** `GET /groups/{id}/sessions?from&to`                                                                                                                                       | to agree                      | The group page downloads the whole timetable and filters it                                               |
| B-6 | **Paging for the all-time session list:** `GET /schedule?from&to&page&pageSize`, or a cursor                                                                                                          | to agree                      | Attendance's "All time" downloads everything                                                              |
| B-7 | **Bulk endpoints** for assigning or moving many students at once                                                                                                                                      | to agree                      | One request per student                                                                                   |

## 2. To check: security, enforced on the server

The frontend hides what a role may not use, but only the server can refuse it.

| #   | Check                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | **Students:** refused when they write attendance, and limited to reading their own records (their own mark on a session, their own reports).                                                                                                                                              |
| S-2 | **The register's 24-hour window:** writes after it are refused for instructors and allowed for admins (operations), as the frontend assumes. **Question:** may the instructor who taught the class still file a late register? If so, the session page's lock is stale and should change. |
| S-3 | **Students created with the old default password `pass2word`:** can they be forced to set a new one at their next sign-in?                                                                                                                                                                |
| S-4 | **The refresh cookie:** confirm `HttpOnly`, `Secure` and `SameSite=Strict` (or `Lax`) before the frontend moves the access token out of `localStorage` and into memory.                                                                                                                   |
| S-5 | **KPI adjustments and approval** (once built): admin only. Adjusting is refused before the 29th and on approved months. Approval is refused before the month has ended.                                                                                                                   |

## 3. To answer: behaviour the frontend relies on

| #   | Question                                                                                                                                            | Why it matters                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-1 | `PUT /users/{id}` with one `groupId`, used for "add a student to this group": does it **add** the group, or **replace** the student's other groups? | Students can be in several groups. If it replaces them, adding someone silently removes them from their other groups. The frontend would need an "add to group" endpoint. |
| Q-2 | Does `PUT /groups/{id}` accept `endDate: null`?                                                                                                     | A group's end date follows its last class, and a new group has none yet.                                                                                                  |
| Q-3 | Does `mineOnly` filter on the server for sales holds and candidates?                                                                                | If not, "Mine" only hides other people's in the browser.                                                                                                                  |
| Q-4 | Is `instructorId` always set on sessions?                                                                                                           | The grids and register matching use the id. A session without one cannot be placed.                                                                                       |
| Q-5 | Does `GET /schedule` with only `from` apply a default end?                                                                                          | The Groups list asks for upcoming classes that way.                                                                                                                       |
| Q-6 | Bulk assign sends an empty email for students who have none: is that accepted, or does it overwrite a stored email?                                 | —                                                                                                                                                                         |

## 4. For whoever deploys

- **CORS** for the app's origin. For `POST /client-errors`, allow `Content-Type`, and do
  not allow credentials: reports are sent without any.
- **A new API host** has to go into the frontend's `connect-src`
  (`nginx-security-headers.conf` and `vercel.json`), or the browser refuses every
  request to it.
- **See `docs/deployment.md`.**
