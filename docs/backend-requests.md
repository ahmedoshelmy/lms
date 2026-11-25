# What the frontend needs from the backend

Everything the frontend work has found that only the server can do or answer, in one
place. Contracts are in `docs/*.api.md`.

On 2026-11-25 the backend session read the backend's source (`D:\lms-backend`, the same
API) and answered the questions and checks. Its answers are recorded here, with what the
frontend changed because of them.

## 1. To build (with the user for prioritising)

| #   | What                                                                                                                                                                                   | Contract                      | Frontend meanwhile                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| B-1 | **Instructor KPIs.** The backend's estimate: the largest item, with 10 endpoints, an adjust, approve and reopen state machine, an approval snapshot, a PDF by email, and audit entries | `docs/instructor-kpis.api.md` | Built against the contract; off in production                                        |
| B-2 | **Client error reports:** `POST /client-errors`                                                                                                                                        | `docs/client-errors.api.md`   | Built; off until `environment.errorReportUrl` is set                                 |
| B-3 | **Recording issued certificates (W-07)**                                                                                                                                               | to agree first                | Generated in the browser, not recorded                                               |
| B-4 | **Profile edit and password change** for the signed-in user                                                                                                                            | to agree                      | Those parts of the profile page are hidden                                           |
| B-5 | **Sessions for one group.** The backend suggests checking whether `GET /schedule`'s `from` and `to` (plus a group filter) cover it before a new route                                  | to agree                      | The group page downloads the whole timetable                                         |
| B-6 | **Paging for session lists.** Urgent, as `GET /schedule?from=` alone is unbounded (Q-5)                                                                                                | to agree                      | Attendance's "All time", and the Groups list's upcoming classes, download everything |
| B-7 | **Bulk endpoints** for assigning or moving many students                                                                                                                               | to agree                      | One request per student                                                              |
| B-8 | **New: `PUT /users/{id}` with patch semantics.** Today a blank or missing email or phone may clear the stored one (Q-6). The backend is raising it                                     | –                             | Every caller sends the stored values back                                            |
| B-9 | **New: a forced password reset** for students made with `pass2word` (S-3). Needs a user column and a sign-in change                                                                    | –                             | –                                                                                    |

## 2. Security, checked against the backend's source

| #   | Check                                                                   | Answer                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | Students refused on attendance writes, and limited to their own records | **Enforced:** `[Authorize(Roles="Instructor,Admin")]` on the writes. The trial endpoints rely on the service check, which answers 400 rather than 403; an attribute would add depth.                                                                                                                                                            |
| S-2 | The register's 24-hour window                                           | **The window is a measurement, not a permission.** The instructor who taught the class may take the register however late; `WhyCannotEditAsync` has no time check. **The frontend's lock was stale and is removed:** see the implementation log, "Backend answers".                                                                             |
| S-3 | Students with `pass2word` forced to reset                               | **No mechanism exists.** Every student made that way shares one publicly known password: a real security gap. Now B-9.                                                                                                                                                                                                                          |
| S-4 | Refresh cookie flags                                                    | `HttpOnly` and `Secure`, but **`SameSite=None`**. `Lax` would work, since the app and the API share `inite.tech`; to raise with whoever owns sign-in. There is also an `HttpOnly` `LMSAuth` cookie carrying the access token, so the API can already authenticate by cookie alone. The `localStorage` token may be redundant, not just movable. |
| S-5 | KPI adjust and approve rules                                            | Not built yet (B-1).                                                                                                                                                                                                                                                                                                                            |

## 3. Behaviour, answered

| #   | Question                                            | Answer, and what the frontend does                                                                                                                                                                                    |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-1 | `PUT /users/{id}` with a `groupId`: add or replace? | **Adds.** `AddStudentToGroupAsync` inserts, or revives a row the student left. Other groups are untouched. Nothing to change.                                                                                         |
| Q-2 | `PUT /groups/{id}` with `endDate: null`?            | **Refused (400):** `EndDate` is a non-nullable `DateOnly`. The server works the end date out from the classes. **Fixed:** the frontend sends the start date when there is no end yet.                                 |
| Q-3 | `mineOnly` on the server?                           | **Yes.** Non-admins only ever get their own; admins get everything unless `mineOnly=true`.                                                                                                                            |
| Q-4 | `instructorId` always set?                          | **A non-nullable `int`, but 0 for a group with no default instructor.** The frontend already treats 0 as none.                                                                                                        |
| Q-5 | `GET /schedule` with only `from`: a default end?    | **No: unbounded.** See B-6. The Groups list needs every remaining class to count them, so it cannot simply be capped.                                                                                                 |
| Q-6 | A blank email on `PUT /users/{id}`                  | **Clears the stored email** (`user.Email = email`, unconditional), also through `PUT /students/{id}`. Every frontend caller sends the stored email back. The server fix is B-8. **Open:** does phone behave the same? |

Related: a student created without an email gets `{name}.{1000-9999}@lms.local`. That
domain is unroutable, so those addresses reach nobody.

## 4. For whoever deploys

- **CORS** for the app's origin. For `POST /client-errors`, allow `Content-Type`, and do
  not allow credentials: reports are sent without any.
- **A new API host** has to go into the frontend's `connect-src`
  (`nginx-security-headers.conf` and `vercel.json`).
- **See `docs/deployment.md`.**
