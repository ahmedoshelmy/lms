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
        path: 'sessions/:id',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('sessions') },
        loadComponent: () =>
          import('./features/sessions/session-detail/session-detail.component').then(
            (c) => c.SessionDetailComponent
          ),
      },
      {
        path: 'attendance',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('attendance') },
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((c) => c.AttendanceComponent),
      },
      {
        path: 'groups',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('groups') },
        loadComponent: () =>
          import('./features/groups/groups.component').then((c) => c.GroupsComponent),
      },
      {
        path: 'groups/:id',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('groups') },
        loadComponent: () =>
          import('./features/groups/group-detail/group-detail.component').then(
            (c) => c.GroupDetailComponent
          ),
      },
      {
        path: 'students',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('students') },
        loadComponent: () =>
          import('./features/students/students.component').then((c) => c.StudentsComponent),
      },
      {
        path: 'students/:id',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('students') },
        loadComponent: () =>
          import('./features/students/student-detail/student-detail.component').then(
            (c) => c.StudentDetailComponent
          ),
      },
      {
        path: 'instructors',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('instructors') },
        loadComponent: () =>
          import('./features/instructors/instructors.component').then(
            (c) => c.InstructorsComponent
          ),
      },
      {
        path: 'instructors/:id',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('instructors') },
        loadComponent: () =>
          import('./features/instructors/instructor-detail/instructor-detail.component').then(
            (c) => c.InstructorDetailComponent
          ),
      },
      {
        path: 'history',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('history') },
        loadComponent: () =>
          import('./features/history/history.component').then((c) => c.HistoryComponent),
      },
      {
        path: 'activity-logs',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('activity-logs') },
        loadComponent: () =>
          import('./features/activity-logs/activity-logs.component').then(
            (c) => c.ActivityLogsComponent
          ),
      },
      { path: 'users', redirectTo: 'students', pathMatch: 'full' },

      {
        path: 'availability',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('availability') },
        loadComponent: () =>
          import('./features/availability/availability.component').then(
            (c) => c.AvailabilityComponent
          ),
      },

      {
        path: 'session-summaries',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('session-summaries') },
        loadComponent: () =>
          import('./features/session-summaries/session-summaries.component').then(
            (c) => c.SessionSummariesComponent
          ),
      },

      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('settings') },
        loadComponent: () =>
          import('./features/settings/settings.component').then((c) => c.SettingsComponent),
      },

      {
        path: 'profile',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('profile') },
        loadComponent: () =>
          import('./features/profile/profile.component').then((c) => c.ProfileComponent),
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
