# LMS frontend

The Angular frontend for the school's learning-management and student-management system:
schedules and registers, groups and courses, monthly reports, sales and availability. It
serves four roles (Admin, Instructor, Sales, Student) and talks to a separate .NET API.

## Requirements

- Node.js 20.19+, 22.12+ or 24 (CI uses 22)
- npm 11 (pinned in `package.json`)

## Getting started

```bash
npm ci
npm start            # http://localhost:4200, development build
```

The API address comes from `src/environments/environment*.ts`. A development build can point
at a different API from **Settings**; a production build cannot.

## Checks

These are what CI runs (`.github/workflows/ci.yml`), and all must pass:

```bash
npm run format:check
npm run lint         # 0 errors; warnings are tracked debt
npm run test:ci      # Vitest, once
npm run build        # production build, with bundle budgets
```

On Windows, run the tests from an upper-case drive path (`I:\lms`, not `i:\lms`).

## Deployment

`npm run build` writes static files to `dist/lms-platform/browser`. The `Dockerfile` serves
them with nginx (`nginx.conf`); `.do/app.yaml` deploys that image.

## Documentation

- [AGENTS.md](AGENTS.md): architecture and conventions for anyone changing the code
- [docs/frontend-audit.md](docs/frontend-audit.md): what the November 2026 audit found
- [docs/frontend-roadmap.md](docs/frontend-roadmap.md): the plan, with decisions taken
- [docs/frontend-implementation-log.md](docs/frontend-implementation-log.md): what has been
  done, why and how it was checked
