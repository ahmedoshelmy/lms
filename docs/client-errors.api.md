# Client error reports — API contract

The frontend reports errors nobody caught to the school's own server, so a fault is
known before somebody rings about it. The backend has the endpoint (`ClientErrorsController`,
backend commit `feat(client-errors)`), and `errorReportUrl` in
`src/environments/environment.ts` points at it. The development build keeps it `null`, so
errors from a developer's machine stay out of the school's records.

## Endpoint

`POST /client-errors`, on the API host, for example `https://mv-api.inite.tech/api/client-errors`.

- **No authentication.** Reports are sent with `fetch` and `keepalive` (they outlive the
  page) and `credentials: 'omit'`: no cookie and no `Authorization` header goes with them. A report can come from the sign-in
  page, before anybody is signed in.
- **Body:** `Content-Type: application/json`, at most about 6 kB.
- **Answer:** `204 No Content`. Nobody reads it.
- **CORS:** allow the app's origin, with `POST` and the `Content-Type` header (the
  browser sends a preflight `OPTIONS` first). Do not set
  `Access-Control-Allow-Credentials`: reports carry none.

```ts
interface ClientErrorReport {
  message: string; // up to 500 characters
  stack: string | null; // up to 20 lines, 4000 characters
  path: string; // the page, ids masked, no query string: "/students/:id"
  release: string | null; // the build: the hash in main-<hash>.js
  role: 'Student' | 'Instructor' | 'Admin' | 'Sales' | null; // null before sign-in
  userAgent: string; // up to 300 characters
  at: string; // ISO date-time, the browser's clock
}
```

## What the server should do

- **Validate and cap.** Reject bodies over 8 kB, unknown fields and wrong types with
  `400`.
- **Rate-limit by IP address:** for example 60 reports a minute, with `429` past that.
  The browser already sends the same error once a page load, and at most 20 in all.
- **Store** the report with the time it was received. Group reports by
  `message + first stack line + release` to count occurrences.
- **Alert** when a new group appears after a release, or one grows quickly.
- **Keep reports 90 days.** They hold no personal data:
  - no names, emails, ids, typed text or query strings;
  - the page path has its ids masked;
  - the person is known only by their role.

  Do not add anything that would change that, such as the user id or the IP address in
  the stored record.

## Content-Security-Policy reports

What the browser refuses under the frontend's policy is reported too, by the browser
itself, to `POST /client-errors/csp`:

- `report-to csp` in the policy, with `Reporting-Endpoints: csp="…/client-errors/csp"`;
- `report-uri …/client-errors/csp` for browsers without the Reporting API.

Both are in `nginx-security-headers.conf` and `vercel.json`, and
`e2e/deploy-config.spec.ts` checks they name the same address. The server keeps only
what was refused (its host, or the browser's word such as `inline`), under which rule,
and the page path with ids masked.

## Switching it on

1. Deploy the endpoint.
2. Set `errorReportUrl` in `src/environments/environment.ts` to its full address.
3. If it is on a host other than the API's, add that host to `connect-src` in both
   `nginx-security-headers.conf` and `vercel.json`. `e2e/deploy-config.spec.ts` checks
   the two agree.
4. Release. Then check that a report arrives, for example by running
   `throw new Error('report test')` from the browser console on the live site.

## As built

What the server does where the contract above left room:

- **Too large:** a body over 8 kB is refused with `413` (the server's own limit), not
  `400`.
- **Cleaned again on arrival.** Whatever the browser sent, the server takes out query
  strings, fragments and email addresses, and masks ids in the path. It stores neither
  the user nor the address.
- **Rate limit:** 60 a minute for each address. The address is the last one the proxy adds
  to `X-Forwarded-For`, and is used for counting only.
- **Grouping:** reports are grouped by a fingerprint of the kind, the message, the first
  stack line below it and the release.
- **Alerts:** one in-app note to the admins each evening, only on days with errors not seen
  before, listing the most frequent. It is one a day, not one per error, because anybody
  can post to the endpoint: a stranger can fill the table, but not the admins'
  notifications.
- **Reading them:** `GET /client-errors?days=7` (admin only) gives the recent errors,
  counted, most frequent first. There is no page for it yet.
- **Kept 90 days**, then removed by the nightly job.
- **Activity log:** the reports are left out of it.
