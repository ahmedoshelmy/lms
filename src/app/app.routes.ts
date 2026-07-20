import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { getRolesForPath } from './core/config/app-navigation.config';

export const routes: Routes = [
  // ── Guest-only ────────────────────────────────────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((c) => c.LoginComponent),
  },

  // ── Authenticated shell (sidebar + layout) ────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layouts/main-layout/main-layout.component').then(
        (c) => c.MainLayoutComponent
      ),
    children: [
      // Default redirect → dashboard (overview page)
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'schedule',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('schedule') },
        loadComponent: () =>
          import('./features/schedule/schedule.component').then((c) => c.ScheduleComponent),
      },

      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('dashboard') },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((c) => c.DashboardComponent),
      },

      {
        path: 'courses',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('courses') },
        loadComponent: () =>
          import('./features/courses/courses.component').then((c) => c.CoursesComponent),
      },

      {
        path: 'progress',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('progress') },
        loadComponent: () =>
          import('./features/progress/progress.component').then((c) => c.ProgressComponent),
      },

      {
        path: 'attendance',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('attendance') },
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((c) => c.AttendanceComponent),
      },

      {
        path: 'resources',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('resources') },
        loadComponent: () =>
          import('./features/resources/resources.component').then((c) => c.ResourcesComponent),
      },
      {
        path: 'groups',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('groups') },
        loadComponent: () =>
          import('./features/groups/groups.component').then((c) => c.GroupsComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('users') },
        loadComponent: () =>
          import('./features/users/users.component').then((c) => c.UsersComponent),
      },

      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('settings') },
        loadComponent: () =>
          import('./features/settings/settings.component').then((c) => c.SettingsComponent),
      },
    ],
  },

  // ── Unauthorized fallback ─────────────────────────────────────────────────
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((c) => c.UnauthorizedComponent),
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
