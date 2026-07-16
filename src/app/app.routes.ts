import { Routes } from '@angular/router';
import { getRolesForPath } from './core/config/app-navigation.config';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layouts/main-layout/main-layout.component').then(
        (c) => c.MainLayoutComponent
      ),
    children: [
      /*
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
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('users') },
        loadComponent: () =>
          import('./features/users/users.component').then((c) => c.UsersComponent),
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
      */
      {
        path: 'schedule',
        canActivate: [roleGuard],
        data: { roles: getRolesForPath('schedule') },
        loadComponent: () =>
          import('./features/schedule/schedule.component').then((c) => c.ScheduleComponent),
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile/profile.component').then((c) => c.ProfileComponent),
      },
      {
        path: '',
        redirectTo: 'schedule',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./shared/layouts/auth-layout/auth-layout.component').then(
        (c) => c.AuthLayoutComponent
      ),
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then((c) => c.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then((c) => c.RegisterComponent),
      },
    ],
  },
  {
    path: 'unauthorized',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((c) => c.UnauthorizedComponent),
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
