import { Routes } from '@angular/router';
import { getRolesForPath } from './core/config/app-navigation.config';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { guestGuard } from './core/guards/guest.guard';
import { Role } from './core/interfaces/Role';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((c) => c.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard, roleGuard],
    data: { roles: getRolesForPath('schedule') },
    loadComponent: () =>
      import('./features/schedule/schedule.component').then((c) => c.ScheduleComponent),
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
