# AI Agent Guidelines - Frontend

Welcome! This repository hosts the frontend application for the LMS (Learning Management System). This document is designed to help AI coding agents quickly understand the architecture, structure, and development conventions of this Angular application to make consistent, high-quality contributions.

---

## 1. Application Architecture & Folder Structure

The application is built using **Angular v21** and follows a modular feature-based folder structure inside the `src/app/` directory:

```
src/app/
├── core/                   # Singleton services, guards, interceptors, and models
│   ├── config/             # Route permissions (app-navigation.config.ts), API address (api-url.ts)
│   ├── enums/              # API enums (AttendanceStatus, SessionStatus, SessionType)
│   ├── errors/             # Global ErrorHandler
│   ├── guards/             # authGuard, guestGuard, roleGuard, unsavedChangesGuard
│   ├── interceptors/       # auth (token + refresh), error (toasts), SILENT_STATUSES token
│   ├── interfaces/         # Type definitions (Role.ts, User.ts, Group.ts, ...)
│   ├── services/           # lms.service.ts (API), auth, session, confirm, notification, ...
│   └── utils/              # Pure, tested helpers (dates, school week, attendance, ...)
│
├── features/               # Lazy-loaded pages: activity-logs, attendance, auth, availability,
│                           # courses, dashboard, evaluations, groups, history, instructors,
│                           # my-learning, operations, profile, sales, schedule,
│                           # session-summaries, sessions, settings, students, unauthorized
│
├── shared/                 # Shared UI
│   ├── components/         # sidebar, command palette, confirm-host, load-error, ...
│   └── layouts/            # main-layout (the signed-in shell)
│
├── app.component.ts        # Root component (holds <router-outlet>)
├── app.config.ts           # App providers (routes, PrimeNG config, HTTP interceptors)
└── app.routes.ts           # Global route definitions

src/environments/           # environment.ts (production) / environment.development.ts
```

Progress and decisions are recorded in `docs/frontend-audit.md`, `docs/frontend-roadmap.md`
and `docs/frontend-implementation-log.md`.

---

## 2. Technology Stack

- **Framework:** Angular 21 (using Standalone Components, newer `inject()` API)
- **Styling System:** Tailwind CSS v4 plus per-component SCSS, with colour tokens as CSS custom properties in `src/styles.css`
- **UI Component Library:** PrimeNG v21 (preset with Aura theme)
- **Icons:** PrimeIcons
- **Build/Test Runner:** Vite / Vitest 4.0 (instead of Karma/Jasmine)
- **Code Formatting:** Prettier (LF line endings, enforced by `.gitattributes`)
- **Linting:** ESLint 9 with `typescript-eslint` and `angular-eslint` (template and accessibility rules)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs format check, lint, tests and a production build

---

## 3. Styling & Theme System

The project uses **Tailwind CSS v4**. Colours are CSS custom properties in `src/styles.css` (see §4.5), used from templates as `text-[var(--color-text-primary)]` and from SCSS as `var(--color-...)`:

- **Primary Color:** `--color-primary` (`#1A2B4C`), hover state `--color-primary-hover` (`#254479`).
- **Secondary Color:** `--color-secondary` (`#3e6db5`), hover state `--color-secondary-hover` (`#2d5594`).
- **Background Canvas:** `--color-background` (`#F7F4EF`), alternative `--color-background-alt` (`#EAE5D9`).
- **Surfaces:** `--color-surface` (`#FFFFFF`), hover state `--color-surface-hover` (`#F9FAFB`).
- **Semantic Colors:** `--color-success` (`#10B981`), `--color-warning` (`#F59E0B`), `--color-danger` (`#EF4444`).

### Component-Level Styles

When writing CSS overrides for PrimeNG or custom layouts in components, write them inside the `@Component` decorator's `styles` block using `:host ::ng-deep` if targeting nested library DOM nodes:

```typescript
@Component({
  ...
  styles: `
    :host ::ng-deep {
      .p-select { border-radius: 10px; border-color: var(--color-border); }
      .p-button { border-radius: 10px; font-weight: 600; }
    }
  `
})
```

---

## 4. Coding Conventions & Best Practices

### Angular Standalone Pattern

- All components, directives, and pipes must be **standalone** (`standalone: true`).
- Explicitly list all imports (like `CommonModule`, router directives, PrimeNG modules) in the `imports` array of the `@Component` metadata.
- Components use `changeDetection: ChangeDetectionStrategy.OnPush` (lint enforces it). The app is
  zoneless, so keep any state that changes later — after a request, a timer, a listener — in
  signals; a plain field set in a `subscribe` callback will not show under `OnPush`.

### Dependency Injection

- Use Angular's modern `inject` function instead of constructor injection for services, routes, and config utilities:
  ```typescript
  private readonly lmsService = inject(LmsService);
  private readonly route = inject(ActivatedRoute);
  ```

### Data Fetching & Interceptors

- Fetch data using `HttpClient` and RxJS Observables.
- **Auth Interceptor:** Attaches the Bearer token automatically to every outgoing API request.
- **Error Interceptor:** Intercepts failures globally, displays error notifications using `NotificationService`, and re-throws the error block.
- **API address:** comes from `src/environments/*` through `resolveApiUrl()` (`core/config/api-url.ts`). Only a development build may override it from Settings.
- **No local fallbacks:** there are no `localStorage` stand-ins for missing endpoints, and a failed request must never be shown as if it succeeded. If an endpoint is missing, hide the feature and record it as a backend dependency.
- **Query parameters:** pass them as `HttpParams` (see `query()` in `lms.service.ts`), never by string concatenation.
- **Filter- or route-driven loads:** pipe them through a `latestRequest()` (`core/utils/latest-request.ts`) so an older response can never overwrite a newer one.
- **Failed loads:** show `<app-load-error>` with a retry, not the page's empty state.

### Form Handling

- **Simple Forms:** Use Template-driven forms (`[(ngModel)]`) for simple inputs or dialog workflows.
- **Complex/Critical Forms:** Use **Reactive Forms** (specifically `FormBuilder` with `fb.nonNullable.group` and Angular `Validators`) for full verification and custom validations (e.g., email checks, password matching).

---

## 4.5. Color Theme System (Light + Dark)

All colors are centralized as CSS custom properties in `src/styles.css`:

- **Light values** are defined on `:root`.
- **Dark values** override the **same variable names** inside the `[data-theme="dark"]` block.
- There is one shared theme for all roles (Student, Instructor, Admin) — no per-role colors.

### Rules

- Every color is defined **once** as a `--color-*` token. To rebrand, only edit `--color-primary` (and its hover/active/content variants) — no component file should ever need to change.
- **No component may hardcode a hex, `rgb()`, or `rgba()` color** in SCSS, templates, or inline styles. Always reference `var(--color-*)`. If no token fits, add a new `--color-*` token to `styles.css` (never a literal in a component).
- Generic shadows using `rgba(0,0,0,...)` are acceptable; semantic/tinted colors must use tokens.

### ThemeService

- `ThemeService` toggles `data-theme="light" | "dark"` on `<html>`, persists the choice in `localStorage`, and defaults to **light** on first load.
- Use `inject(ThemeService)` and call `toggleTheme()` / read `theme$` rather than manipulating `data-theme` manually.

---

## 5. Routing Conventions

Routes are configured in `src/app/app.routes.ts`.

- All feature routes are **lazy-loaded** using dynamic imports.
- Guards are assigned to protect routes:
  - `authGuard` prevents guest access.
  - `guestGuard` prevents authenticated users from viewing login/register views.
  - `roleGuard` blocks users whose roles are not permitted. Roles come from `ROUTE_PERMISSIONS` in `core/config/app-navigation.config.ts`, the single source for routes, the sidebar and the command palette. A route with no roles there is **denied**; `app-navigation.config.spec.ts` fails if a guarded route is missing from the table.
  - `unsavedChangesGuard` asks before leaving a page whose component implements `HasUnsavedChanges`.
- Before offering a link to another page, check `auth.canAccess('path')`, so nobody is sent to "Access denied".
- Role checks are presentation only; the server enforces every permission.

### Example Route Definition

```typescript
{
  path: 'courses',
  canActivate: [roleGuard],
  data: { roles: getRolesForPath('courses') },
  loadComponent: () =>
    import('./features/courses/courses.component').then((c) => c.CoursesComponent),
}
```

---

## 6. CLI Commands

Verify configurations and run the development app using these commands from the root directory:

| Action                      | Command                       |
| :-------------------------- | :---------------------------- |
| **Start Dev Server**        | `npm run start` or `ng serve` |
| **Run Unit Tests (Vitest)** | `npm run test` or `ng test`   |
| **Unit Tests, once (CI)**   | `npm run test:ci`             |
| **Lint**                    | `npm run lint`                |
| **Build for Production**    | `npm run build` or `ng build` |
| **Format Files**            | `npm run format`              |
| **Check Format**            | `npm run format:check`        |

On Windows, run the tests from an upper-case drive path (`I:\lms`, not `i:\lms`): from the
lower-case path Vitest loads its runner twice and every file fails with "failed to find the
runner".

---

## 7. Common Pitfalls & Code Quality

- > [!WARNING]
  - **SSR & LocalStorage Checks:** The app is currently built and deployed as a client-side app only (the unused SSR scaffolding was removed in November 2026; see `docs/frontend-implementation-log.md`). Keep wrapping `localStorage` or `window` interactions with platform checks anyway, so server rendering or prerendering can be added back without breaking:

    ```typescript
    private readonly platformId = inject(PLATFORM_ID);

    if (isPlatformBrowser(this.platformId)) {
      // Safe to access localStorage/window here
    }
    ```

- > [!IMPORTANT]
  - **Duplicate Notifications:** Avoid triggering manual toast alerts for failed HTTP operations inside components. The global `errorInterceptor` automatically handles displaying error messages.
- > [!IMPORTANT]
  - **Dates:** never use `toISOString().slice(0, 10)` for a calendar date: east of UTC it gives the previous day. Use `toIsoDate` / `todayIsoDate` / `fromIsoDate` from `core/utils/date.utils.ts`. The school week (Saturday to Friday) is defined once in `core/utils/week.utils.ts`.
- > [!IMPORTANT]
  - **Destructive actions:** ask first with `ConfirmService.ask()`, which shows the shared dialog with the safe choice focused. Do not use `window.confirm` or `prompt`.
- > [!NOTE]
  - **Signing out:** use `SessionService.signOut()`. It clears everything a session left behind and keeps other tabs in step.
- > [!NOTE]
  - **PrimeNG Element Positioning:** PrimeNG elements styled with absolute positioning (such as select elements and dialogs) may occasionally conflict with parent layouts. Ensure that deep overrides (`::ng-deep`) do not leak globally and are scoped to the host component.

---

## 8. AI Agent Guidelines

1. **Reuse Existing Abstractions:** Reuse existing services (`AuthService`, `LmsService`, `NotificationService`, `ConfirmService`, `SessionService`), utilities in `core/utils`, shared components (`app-load-error`, `app-confirm-host`) and the colour tokens instead of writing new ones.
2. **Follow Project Patterns:** Build standalone components, use `inject()` for dependency resolution, configure routes via lazy-loading, and leverage PrimeNG widgets for interactive elements.
3. **Keep Changes Minimal:** Apply changes in a highly localized manner. Do not refactor styles or layouts that are unrelated to your current task.
4. **Avoid Unnecessary Dependencies:** Do not add third-party styling packages, icon packs, or HTTP wrappers. Stick to Tailwind CSS v4, PrimeNG, and native Angular features.
5. **Preserve Compatibility:** Maintain backward compatibility for users, storage structures, and models. Always use platform checks when touching browser-specific APIs (SSR compliance).
6. **Colors via Tokens Only:** Never hardcode hex/`rgb`/`rgba` colors in any component. Use the centralized `--color-*` tokens from `src/styles.css` (see §4.5). Add new tokens there instead of literals in components.
7. **Keep Documentation Up-to-Date:** Update feature routing and type definitions if you add components, services, or pages, and record notable changes in `docs/frontend-implementation-log.md`.
8. **Leave the checks green:** `npm run format:check`, `npm run lint` (0 errors), `npm run test:ci` and `npm run build` must all pass. Bug fixes come with a test that fails without the fix.
