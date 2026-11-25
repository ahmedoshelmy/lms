# Deploying the frontend

The app is a static build: `npm run build` writes everything to
`dist/lms-platform/browser`, and any web server that sends the right headers can
serve it. Two targets are set up. Use one of them and keep the other's file only if
it is still used.

| Target                                 | Files                                                     | Notes                                                                           |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Docker + nginx** (the one to prefer) | `Dockerfile`, `nginx.conf`, `nginx-security-headers.conf` | Behind the school's TLS proxy or load balancer. The image has a health check.   |
| **Vercel**                             | `vercel.json`                                             | The same headers and caching as nginx; `e2e/deploy-config.spec.ts` checks that. |

## Before a release

- [ ] **CI is green** on the commit: format, lint, unit tests, production build
      (budget 600 kB), and the end-to-end job (Playwright and axe, desktop and phone,
      light and dark, under the production Content-Security-Policy).
- [ ] **The API address** in `src/environments/environment.ts` is the production
      one, and the same host is in `connect-src` in both header files. A request to a
      host the policy does not list is refused by the browser.
- [ ] **Features waiting on the backend** (`environment.features`) are on only if
      their endpoints are live. See `docs/instructor-kpis.api.md`.
- [ ] **Error reports** (`errorReportUrl`): set if `docs/client-errors.api.md` is
      live, otherwise `null`.

## Building and running

```sh
# Docker
docker build -t lms-frontend .
docker run -p 8080:80 lms-frontend      # then http://localhost:8080

# Without Docker
npm ci
npm run build                            # dist/lms-platform/browser
```

The Dockerfile installs dependencies with `npm ci`, without Playwright's browsers, and
builds on Node 22, as CI does. nginx then serves the build with:

- **Security headers on every response** (`nginx-security-headers.conf`):
  Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, a referrer policy
  and a permissions policy.
- **Caching:**
  - files named by their content (`main-ABCD1234.js`, `styles-….css`, `media/`) are
    cached for a year, as immutable;
  - icons and artwork for a day;
  - the app shell and the service worker's files (`index.html`, `ngsw.json`,
    `ngsw-worker.js`, the manifest) are never cached;
  - gzip for text.
- **Routes:** every route answers with `index.html`.

## After a release

1. **Open the site in a private window.** Sign in, open a few pages, and check the
   browser console shows no Content-Security-Policy refusals.
2. **Open a tab that was already open before the release.** Within a few seconds of a
   navigation (or six hours at most), it shows "A new version of the app is ready".
3. **Check the headers:** `curl -I https://<site>/` and
   `curl -I https://<site>/main-<hash>.js`. The first has the security headers and
   `no-cache`; the second has `immutable`.

## Rolling back

Deploy the previous build: `git checkout <tag> && docker build`, or redeploy the
previous Vercel deployment. Open tabs pick it up as an update, like any release. The
service worker only follows `ngsw.json`, so nothing more is needed.

**If the service worker itself ever has to go**, for example a broken worker keeping
people on a bad version:

1. Deploy a build with `ngsw-worker.js` replaced by Angular's `safety-worker.js`
   (`node_modules/@angular/service-worker/safety-worker.js`), copied to the same name.
2. It unregisters itself and clears its caches on each browser's next visit.
3. Once everyone has visited, restore the normal build.

## Monitoring

- **Front-end errors** go to the school's own server once `errorReportUrl` is set
  (`docs/client-errors.api.md`): no third-party service, and no personal data in a
  report.
- **Server-side errors** are logged by the API itself; the frontend does not report
  failed requests again.
- **Uptime:** point an uptime check at `https://<site>/index.html`. The Docker image's
  health check does the same inside the container.

## Content-Security-Policy, in short

- **No inline script and no `eval`.** That is why the production build does not inline
  critical CSS (`angular.json`), whose loader is an inline handler.
- **Styles may be inline,** because PrimeNG sets them at runtime.
- **Requests may go to the site and the API only.**
- **The site may not be framed.**

Adding a third-party script, font or API means adding its host to both header files.

What the tests cover: the end-to-end tests serve the **development** build with these
headers, so the policy applies to every page they open. The production-only differences
are each checked another way. `e2e/deploy-config.spec.ts` checks that critical-CSS
inlining stays off and that the Vercel headers equal nginx's. `nginx.conf` itself (its
locations and the `include`) is not run by any test: build the Docker image and use
`curl -I` after a change to it.
The end-to-end tests run under this policy and fail on any refusal.
