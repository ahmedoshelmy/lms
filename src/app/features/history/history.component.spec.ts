import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { HistoryComponent } from './history.component';

describe('HistoryComponent', () => {
  it('says the history could not be loaded, rather than that there is none', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LmsService,
          useValue: {
            getCourses: () => of([]),
            getAllGroupsHistory: () => throwError(() => new Error('down')),
            getSessionHistory: () => of([]),
          },
        },
        { provide: NotificationService, useValue: {} },
        { provide: AuthService, useValue: { hasRole: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(HistoryComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Group history could not be loaded');
    expect(text).not.toContain('No group course history records found');
  });
});
