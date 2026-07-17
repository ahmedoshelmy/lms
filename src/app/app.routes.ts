import { Routes } from '@angular/router';
import { getRolesForPath } from './core/config/app-navigation.config';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/schedule/schedule.component').then((c) => c.ScheduleComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
