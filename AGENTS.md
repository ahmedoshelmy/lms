# AI Agent Guidelines - Frontend

Welcome! This repository hosts the frontend application for the LMS (Learning Management System). This document is designed to help AI coding agents quickly understand the architecture, structure, and development conventions of this Angular application to make consistent, high-quality contributions.

---

## 1. Application Architecture & Folder Structure

The application is built using **Angular v21** and follows a modular feature-based folder structure inside the `src/app/` directory:

```
src/app/
├── core/                   # Singleton services, guards, interceptors, and models
│   ├── config/             # Navigation and application configurations
│   ├── guards/             # Route activation guards (e.g., auth.guard, role.guard)
│   ├── interceptors/       # HTTP interceptors (auth token attachment, error handling)
│   ├── interfaces/         # Type definitions (e.g., Role.ts)
│   ├── models/             # App models (e.g., User.ts)
│   └── services/           # Data services (e.g., auth.service.ts, lms.service.ts)
│
├── features/               # Feature modules (lazy-loaded pages/components)
│   ├── attendance/         # Attendance tracking feature
│   ├── auth/               # Authentication pages (login, register)
│   ├── courses/            # Course catalog and course management
│   ├── dashboard/          # Home / summary dashboard
│   ├── profile/            # User profile settings
│   ├── progress/           # Course progress tracker
│   ├── resources/          # Reference resources and study material
│   └── unauthorized/       # Unauthorized access fallback view
│
├── shared/                 # Shared UI layouts and components
│   ├── components/         # Reusable global components (e.g., sidebar)
│   └── layouts/            # Global page shells (e.g., main-layout, auth-layout)
│
├── app.component.ts        # Root component (holds <router-outlet>)
├── app.config.ts           # App providers (routes, PrimeNG config, HTTP interceptors)
└── app.routes.ts           # Global route definitions
```

---

## 2. Technology Stack

- **Framework:** Angular 21 (using Standalone Components, newer `inject()` API)
- **Styling System:** Tailwind CSS v4.0 (configured using CSS `@theme` declarations)
- **UI Component Library:** PrimeNG v21 (preset with Aura theme)
- **Icons:** PrimeIcons
- **Build/Test Runner:** Vite / Vitest 4.0 (instead of Karma/Jasmine)
- **Code Formatting:** Prettier

---

## 3. Styling & Theme System

The project uses **Tailwind CSS v4.0**. The theme is defined directly in `src/styles.css` using the `@theme` directive, generating Tailwind utilities dynamically:

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
      .p-select { border-radius: 10px; border-color: #cbd5e1; }
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
- **Local Storage Fallback:** If a backend endpoint does not exist yet (e.g., attendance records, course resources), `LmsService` implements client-side `localStorage` data management fallbacks. Check `LmsService` before creating mock variables inside components.

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

- `ThemeService` toggles `data-theme="light" | "dark"` on `<html>`, persists the choice in `localStorage`, and defaults to the OS preference (`prefers-color-scheme`) on first load.
- Use `inject(ThemeService)` and call `toggleTheme()` / read `theme$` rather than manipulating `data-theme` manually.

---

## 5. Routing Conventions

Routes are configured in `src/app/app.routes.ts`.

- All feature routes are **lazy-loaded** using dynamic imports.
- Guards are assigned to protect routes:
  - `authGuard` prevents guest access.
  - `guestGuard` prevents authenticated users from viewing login/register views.
  - `roleGuard` dynamically blocks users whose roles are not permitted to view the page.

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
| **Build for Production**    | `npm run build` or `ng build` |
| **Format Files**            | `npm run format`              |
| **Check Format**            | `npm run format:check`        |

---

## 7. Common Pitfalls & Code Quality

- > [!WARNING]
  - **SSR & LocalStorage Checks:** The app is configured with Angular SSR (Server-Side Rendering). Always wrap `localStorage` or `window` interactions with platform checks to avoid server-side execution failures:

    ```typescript
    private readonly platformId = inject(PLATFORM_ID);

    if (isPlatformBrowser(this.platformId)) {
      // Safe to access localStorage/window here
    }
    ```
- > [!IMPORTANT]
  - **Duplicate Notifications:** Avoid triggering manual toast alerts for failed HTTP operations inside components. The global `errorInterceptor` automatically handles displaying error messages.
- > [!NOTE]
  - **PrimeNG Element Positioning:** PrimeNG elements styled with absolute positioning (such as select elements and dialogs) may occasionally conflict with parent layouts. Ensure that deep overrides (`::ng-deep`) do not leak globally and are scoped to the host component.

---

## 8. AI Agent Guidelines

1. **Reuse Existing Abstractions:** Reuse existing services (`AuthService`, `LmsService`, `NotificationService`) and Tailwind v4 theme definitions instead of cooking up custom implementations.
2. **Follow Project Patterns:** Build standalone components, use `inject()` for dependency resolution, configure routes via lazy-loading, and leverage PrimeNG widgets for interactive elements.
3. **Keep Changes Minimal:** Apply changes in a highly localized manner. Do not refactor styles or layouts that are unrelated to your current task.
4. **Avoid Unnecessary Dependencies:** Do not add third-party styling packages, icon packs, or HTTP wrappers. Stick to Tailwind CSS v4, PrimeNG, and native Angular features.
5. **Preserve Compatibility:** Maintain backward compatibility for users, storage structures, and models. Always use platform checks when touching browser-specific APIs (SSR compliance).
6. **Colors via Tokens Only:** Never hardcode hex/`rgb`/`rgba` colors in any component. Use the centralized `--color-*` tokens from `src/styles.css` (see §4.5). Add new tokens there instead of literals in components.
7. **Keep Documentation Up-to-Date:** Update feature routing and type definitions if you add components, services, or pages.
