import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SessionDetailPanelComponent } from './session-detail-panel.component';

const SESSION = {
  id: 7,
  topic: 'Loops',
  instructorId: 3,
  instructorName: 'Original Instructor',
  startsAt: '2026-11-24T16:00:00Z',
  endsAt: '2026-11-24T17:30:00Z',
  durationMinutes: 90,
  location: 'Room 1',
  status: 'Scheduled',
} as ScheduleSession;

/**
 * A change the server refuses must not look like a change that was made. The
 * panel used to emit the edit anyway and say "updated locally (server sync
 * pending)", and nothing ever synced.
 */
describe('SessionDetailPanelComponent saving', () => {
  let lms: { updateSession: ReturnType<typeof vi.fn>; getInstructors: () => unknown };
  let notify: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    lms = { updateSession: vi.fn(), getInstructors: () => of([]) };
    notify = { showSuccess: vi.fn(), showError: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LmsService, useValue: lms },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: { hasRole: () => true, getUserId: () => 1 } },
      ],
    });
  });

  function createPanel() {
    const fixture = TestBed.createComponent(SessionDetailPanelComponent);
    fixture.componentRef.setInput('session', SESSION);
    const panel = fixture.componentInstance;
    const emitted: ScheduleSession[] = [];
    panel.sessionUpdated.subscribe((s) => emitted.push(s));
    return { panel, emitted };
  }

  it('reports nothing as saved when the server refuses', () => {
    lms.updateSession.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );
    const { panel, emitted } = createPanel();
    panel.editStatus.set('Completed');

    panel.executeSave();

    expect(emitted).toEqual([]);
    expect(notify.showSuccess).not.toHaveBeenCalled();
    expect(panel.saving()).toBe(false);
  });

  it('passes the saved session on when the server accepts', () => {
    lms.updateSession.mockReturnValue(of({ ...SESSION, status: 'Completed' }));
    const { panel, emitted } = createPanel();
    panel.editStatus.set('Completed');

    panel.executeSave();

    expect(emitted.length).toBe(1);
    expect(emitted[0].status).toBe('Completed');
    expect(notify.showSuccess).toHaveBeenCalledTimes(1);
  });
});
