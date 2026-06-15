import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/layouts/main-layout/main-layout.component').then(
        (c) => c.MainLayoutComponent,
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((c) => c.DashboardComponent),
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./features/courses/courses.component').then((c) => c.CoursesComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users.component').then((c) => c.UsersComponent),
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./features/progress/progress.component').then((c) => c.ProgressComponent),
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((c) => c.AttendanceComponent),
      },
      {
        path: 'resources',
        loadComponent: () =>
          import('./features/resources/resources.component').then((c) => c.ResourcesComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./shared/layouts/auth-layout/auth-layout.component').then(
        (c) => c.AuthLayoutComponent,
      ),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then((c) => c.LoginComponent),
      },
    ],
  },
];
