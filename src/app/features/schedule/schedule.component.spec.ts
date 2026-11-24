import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Role } from '../../core/interfaces/Role';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { ScheduleComponent } from './schedule.component';

describe('ScheduleComponent', () => {
  it('treats a failed instructor list as a failure, not as "no instructors"', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: LmsService,
          useValue: {
            getScheduleInstructors: () => throwError(() => new Error('down')),
            getInstructorAvailability: () => of([]),
            getTimeOff: () => of([]),
            getApiUrl: () => 'http://api.test',
          },
        },
        { provide: NotificationService, useValue: {} },
        {
          provide: AuthService,
          useValue: { hasRole: (r: Role) => r === Role.Admin, getUserId: () => 1 },
        },
      ],
    });
    const page = TestBed.createComponent(ScheduleComponent).componentInstance;

    page.ngOnInit();

    expect(page.loading()).toBe(false);
    expect(page.loadFailed()).toBe(true);
  });
});
