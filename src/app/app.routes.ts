import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((c) => c.HomeComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'schedule',
        loadComponent: () => import('./features/schedule/schedule.component').then((m) => m.ScheduleComponent),
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/courses/courses.component').then((m) => m.CoursesComponent),
      },
      {
        path: 'groups',
        loadComponent: () => import('./features/groups/groups.component').then((m) => m.GroupsComponent),
      }
    ]
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((c) => c.UnauthorizedComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
