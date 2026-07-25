import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error-interceptor';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { NotificationService } from './core/services/notification.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    MessageService,
    NotificationService,
    providePrimeNG({
      // Use data-theme="dark" so PrimeNG and the CSS token system stay in sync
      theme: { preset: Aura, options: { darkModeSelector: '[data-theme="dark"]' } },
    }),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, authInterceptor])),
  ],
};
