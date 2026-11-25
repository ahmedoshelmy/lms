# Client error reports — API contract

The frontend reports errors nobody caught to the school's own server, so a fault is
known before somebody rings about it. It is switched off until this endpoint exists:
`errorReportUrl` is `null` in `src/environments/environment.ts`.

## Endpoint

`POST /client-errors`, on the API host, for example `https://mv-api.inite.tech/api/client-errors`.

- **No authentication.** Reports are sent with `navigator.sendBeacon`, which cannot add
  an `Authorization` header and outlives the page. A report can come from the sign-in
  page, before anybody is signed in.
- **Body:** `Content-Type: application/json`, at most about 6 kB.
- **Answer:** `204 No Content`. Nobody reads it.
- **CORS:** allow the app's origin, with `POST` and the `Content-Type` header. A beacon
  sends no credentials.

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

## Switching it on

1. Deploy the endpoint.
2. Set `errorReportUrl` in `src/environments/environment.ts` to its full address.
3. If it is on a host other than the API's, add that host to `connect-src` in both
   `nginx-security-headers.conf` and `vercel.json`. `e2e/deploy-config.spec.ts` checks
   the two agree.
4. Release. Then check that a report arrives, for example by running
   `throw new Error('report test')` from the browser console on the live site.
