import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { getRolesForPath } from './core/config/app-navigation.config';

export const routes: Routes = [
  // ── Guest-only ────────────────────────────────────────────────────────────
  {
    path: 'login',
    title: 'Sign in',
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
        title: 'Schedule',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('schedule') },
        loadComponent: () =>
          import('./features/schedule/schedule.component').then((c) => c.ScheduleComponent),
      },

      {
        path: 'dashboard',
        title: 'Overview',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('dashboard') },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((c) => c.DashboardComponent),
      },
      {
        path: 'courses',
        title: 'Courses',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('courses') },
        loadComponent: () =>
          import('./features/courses/courses.component').then((c) => c.CoursesComponent),
      },

      {
        path: 'sessions/:id',
        title: 'Session',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { roles: getRolesForPath('sessions') },
        loadComponent: () =>
          import('./features/sessions/session-detail/session-detail.component').then(
            (c) => c.SessionDetailComponent
          ),
      },
      {
        path: 'attendance',
        title: 'Sessions',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('attendance') },
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((c) => c.AttendanceComponent),
      },
      {
        path: 'my-learning',
        title: 'My Learning',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('my-learning') },
        loadComponent: () =>
          import('./features/my-learning/my-learning.component').then((c) => c.MyLearningComponent),
      },
      {
        path: 'groups',
        title: 'Groups',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('groups') },
        loadComponent: () =>
          import('./features/groups/groups.component').then((c) => c.GroupsComponent),
      },
      {
        path: 'groups/:id',
        title: 'Group',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('groups') },
        loadComponent: () =>
          import('./features/groups/group-detail/group-detail.component').then(
            (c) => c.GroupDetailComponent
          ),
      },
      {
        path: 'students',
        title: 'Students',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('students') },
        loadComponent: () =>
          import('./features/students/students.component').then((c) => c.StudentsComponent),
      },
      {
        path: 'students/:id',
        title: 'Student',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('students') },
        loadComponent: () =>
          import('./features/students/student-detail/student-detail.component').then(
            (c) => c.StudentDetailComponent
          ),
      },
      {
        path: 'evaluations',
        title: 'Monthly Reports',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('evaluations') },
        loadComponent: () =>
          import('./features/evaluations/evaluations.component').then(
            (c) => c.EvaluationsComponent
          ),
      },
      {
        path: 'evaluations/:studentId/:groupId',
        title: 'Monthly Report',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { roles: getRolesForPath('evaluations') },
        loadComponent: () =>
          import('./features/evaluations/evaluation-detail/evaluation-detail.component').then(
            (c) => c.EvaluationDetailComponent
          ),
      },
      {
        path: 'instructor-kpis',
        title: 'Instructor KPIs',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('instructor-kpis') },
        loadComponent: () =>
          import('./features/instructor-kpis/instructor-kpis.component').then(
            (c) => c.InstructorKpisComponent
          ),
      },
      {
        path: 'my-kpis',
        title: 'My KPIs',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('my-kpis') },
        loadComponent: () =>
          import('./features/my-kpis/my-kpis.component').then((c) => c.MyKpisComponent),
      },
      {
        path: 'instructors',
        title: 'Instructors',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('instructors') },
        loadComponent: () =>
          import('./features/instructors/instructors.component').then(
            (c) => c.InstructorsComponent
          ),
      },
      {
        path: 'instructors/:id',
        title: 'Instructor',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('instructors') },
        loadComponent: () =>
          import('./features/instructors/instructor-detail/instructor-detail.component').then(
            (c) => c.InstructorDetailComponent
          ),
      },
      {
        path: 'history',
        title: 'History & Events',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('history') },
        loadComponent: () =>
          import('./features/history/history.component').then((c) => c.HistoryComponent),
      },
      {
        path: 'operations-rota',
        title: 'Operations Rota',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('operations-rota') },
        loadComponent: () =>
          import('./features/operations/operations-rota/operations-rota.component').then(
            (c) => c.OperationsRotaComponent
          ),
      },
      {
        path: 'activity-logs',
        title: 'Activity Analytics',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('activity-logs') },
        loadComponent: () =>
          import('./features/activity-logs/activity-logs.component').then(
            (c) => c.ActivityLogsComponent
          ),
      },
      { path: 'users', redirectTo: 'students', pathMatch: 'full' },

      {
        path: 'sales',
        title: 'Sales',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('sales') },
        loadComponent: () =>
          import('./features/sales/sales.component').then((c) => c.SalesComponent),
      },

      {
        path: 'availability',
        title: 'Availability',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('availability') },
        loadComponent: () =>
          import('./features/availability/availability.component').then(
            (c) => c.AvailabilityComponent
          ),
      },

      {
        path: 'session-summaries',
        title: 'Session Summaries',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('session-summaries') },
        loadComponent: () =>
          import('./features/session-summaries/session-summaries.component').then(
            (c) => c.SessionSummariesComponent
          ),
      },

      {
        path: 'settings',
        title: 'Settings',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('settings') },
        loadComponent: () =>
          import('./features/settings/settings.component').then((c) => c.SettingsComponent),
      },

      {
        path: 'profile',
        title: 'Profile',
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
    title: 'Access denied',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((c) => c.UnauthorizedComponent),
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
