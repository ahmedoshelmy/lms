import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { AttendanceComponent, attendanceRange } from './attendance.component';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { startOfSchoolWeek } from '../../core/utils/week.utils';

describe('attendanceRange', () => {
  // Wednesday 25 November 2026, mid-afternoon.
  const now = new Date(2026, 10, 25, 15, 30);

  it('today is from midnight to the next midnight', () => {
    const { from, to } = attendanceRange('today', now, now);
    expect(from).toEqual(new Date(2026, 10, 25));
    expect(to).toEqual(new Date(2026, 10, 26));
  });

  it('this week is the school week, Saturday to Saturday', () => {
    const { from, to } = attendanceRange('week', now, now);
    expect(from).toEqual(new Date(2026, 10, 21));
    expect(to).toEqual(new Date(2026, 10, 28));
  });

  it('a month runs from its first day to the first of the next, across a year end', () => {
    const { from, to } = attendanceRange('month', new Date(2026, 11, 14), now);
    expect(from).toEqual(new Date(2026, 11, 1));
    expect(to).toEqual(new Date(2027, 0, 1));
  });
});

describe('AttendanceComponent loading', () => {
  function setUp() {
    const getSchedule = vi.fn<(from?: Date, to?: Date) => Observable<unknown[]>>(() => of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LmsService, useValue: { getSchedule, getInstructors: () => of([]) } },
        { provide: NotificationService, useValue: { showWarn: vi.fn(), showSuccess: vi.fn() } },
        { provide: AuthService, useValue: { hasRole: () => true, getUserId: () => 1 } },
      ],
    });
    const fixture = TestBed.createComponent(AttendanceComponent);
    fixture.componentInstance.ngOnInit();
    return { page: fixture.componentInstance, getSchedule };
  }

  it('asks for this school week only, never for every class there has been', () => {
    const { getSchedule } = setUp();

    const [from, to] = getSchedule.mock.calls[0] as [Date | undefined, Date | undefined];
    expect(from).toEqual(startOfSchoolWeek(new Date()));
    expect(to).toBeDefined();
    expect(to!.getTime() - from!.getTime()).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 3600_000);
  });

  it('steps back a month and asks for that month', () => {
    const { page, getSchedule } = setUp();
    page.setDateRangeFilter('month');
    page.stepMonth(-1);

    const [from, to] = getSchedule.mock.calls.at(-1) as [Date, Date];
    const now = new Date();
    expect(from).toEqual(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    expect(to).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
  });

  it('keeps only the classes in the dates on show', () => {
    const { page } = setUp();
    const inWeek = startOfSchoolWeek(new Date());
    const before = new Date(inWeek.getTime() - 60_000);
    page.sessions.set([
      { id: 1, startsAt: before.toISOString(), status: 'Completed' },
      { id: 2, startsAt: inWeek.toISOString(), status: 'Scheduled' },
    ] as never);

    expect(page.filteredSessions().map((s) => s.id)).toEqual([2]);
  });
});
