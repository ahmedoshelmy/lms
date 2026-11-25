import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceStatus } from '../../../core/enums/AttendanceStatus';
import { Role } from '../../../core/interfaces/Role';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SessionDetailComponent } from './session-detail.component';

@Component({ template: '' })
class Blank {}

const HOUR = 60 * 60 * 1000;

/** A class `hoursAgo` hours ago with three children, nobody marked yet. */
function session(hoursAgo: number): ScheduleSession {
  return {
    id: 7,
    topic: 'Loops',
    groupName: 'Python L1 – Sat',
    instructorId: 3,
    instructorName: 'Mona',
    startsAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
    endsAt: new Date(Date.now() - hoursAgo * HOUR + 1.5 * HOUR).toISOString(),
    durationMinutes: 90,
    status: 'Scheduled',
    attendances: [
      { id: 1, studentId: 21, studentName: 'Sara Ahmed', status: null },
      { id: 2, studentId: 22, studentName: 'Omar Ali', status: null },
      { id: 3, studentId: 23, studentName: 'Laila Mahmoud', status: null },
    ],
  } as unknown as ScheduleSession;
}

/**
 * The register: what an instructor does after every class. Driven through
 * the page's own buttons, as a person would.
 */
function render(
  opts: { hoursAgo?: number; role?: Role; userId?: number; save?: () => unknown } = {}
) {
  const role = opts.role ?? Role.Instructor;
  const saveBulkAttendance = vi.fn<(id: number, items: unknown[]) => unknown>(
    opts.save ?? (() => of({}))
  );
  const notify = { showSuccess: vi.fn(), showWarn: vi.fn(), showError: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'schedule', component: Blank }]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
      },
      {
        provide: LmsService,
        useValue: {
          getSessionDetails: () => of(session(opts.hoursAgo ?? 2)),
          getSessionTrials: () => of([]),
          getSessionSyllabus: () => of(null),
          getInstructors: () => of([]),
          saveBulkAttendance,
        },
      },
      { provide: NotificationService, useValue: notify },
      {
        provide: AuthService,
        // The class (instructorId 3) is this instructor's unless told otherwise.
        useValue: { hasRole: (r: Role) => r === role, getUserId: () => opts.userId ?? 3 },
      },
    ],
  });
  const fixture = TestBed.createComponent(SessionDetailComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const saveButton = () =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Save Attendance'));
  const press = (label: string) => {
    button(label)!.click();
    fixture.detectChanges();
  };
  return {
    fixture,
    el,
    page: fixture.componentInstance,
    saveBulkAttendance,
    notify,
    button,
    saveButton,
    press,
  };
}

describe('Taking the register', () => {
  it('sends the whole class in one request once everyone is marked', () => {
    const { page, press, saveButton, saveBulkAttendance, notify } = render();

    press('Mark Sara Ahmed present');
    press('Mark Omar Ali absent');
    // Not everyone yet: saving waits.
    expect(saveButton()!.disabled).toBe(true);

    press('Mark Laila Mahmoud present');
    expect(saveButton()!.disabled).toBe(false);
    saveButton()!.click();

    expect(saveBulkAttendance).toHaveBeenCalledTimes(1);
    expect(saveBulkAttendance).toHaveBeenCalledWith(7, [
      { studentId: 21, status: AttendanceStatus.Present, taskDone: null, assignmentDone: null },
      { studentId: 22, status: AttendanceStatus.Absent, taskDone: null, assignmentDone: null },
      { studentId: 23, status: AttendanceStatus.Present, taskDone: null, assignmentDone: null },
    ]);
    expect(notify.showSuccess).toHaveBeenCalled();
    expect(page.hasUnsavedChanges()).toBe(false);
  });

  it('carries the task and assignment marks with the register', () => {
    const { page, saveBulkAttendance } = render();
    page.bulkSetStatus('Present');
    page.bulkSetTask('task', true);
    // Sara: done -> not done.
    page.cycleTask(page.records()[0], 'task');

    page.saveAttendance();

    const sent = saveBulkAttendance.mock.calls[0][1] as { taskDone: boolean | null }[];
    expect(sent.map((r) => r.taskDone)).toEqual([false, true, true]);
  });

  it('refuses a half-marked register and shows who is left', () => {
    const { page, saveBulkAttendance, notify } = render();
    page.setStatus(page.records()[0], 'Present');

    page.saveAttendance();

    expect(saveBulkAttendance).not.toHaveBeenCalled();
    expect(notify.showWarn).toHaveBeenCalled();
    expect(page.rosterStatusFilter()).toBe('Pending');
  });

  it('keeps the marks, and the page unsaved, when the server refuses them', () => {
    const { page, notify } = render({ save: () => throwError(() => new Error('refused')) });
    page.bulkSetStatus('Present');

    page.saveAttendance();

    expect(notify.showSuccess).not.toHaveBeenCalled();
    expect(page.records().every((r) => r.status === 'Present')).toBe(true);
    expect(page.hasUnsavedChanges()).toBe(true);
  });

  it('stays open to the instructor who taught it after a day, as a late register', () => {
    const { page, press } = render({ hoursAgo: 30 });

    expect(page.isLateEntry()).toBe(true);
    press('Mark Sara Ahmed present');
    expect(page.records()[0].status).toBe('Present');
  });

  it('is not for an instructor who did not teach the class', () => {
    const { page, button } = render({ userId: 9 });

    expect(button('Mark Sara Ahmed present')).toBeNull();
    page.setStatus(page.records()[0], 'Present');
    expect(page.records()[0].status).toBe('Pending');
  });

  it('leaves it open to operations after the window, as a late entry', () => {
    const { page, press } = render({ hoursAgo: 30, role: Role.Admin });

    expect(page.isLateEntry()).toBe(true);
    press('Mark Sara Ahmed present');
    expect(page.records()[0].status).toBe('Present');
  });

  it('cannot be taken before the class', () => {
    const { page } = render({ hoursAgo: -48 });

    page.bulkSetStatus('Present');

    expect(page.records().every((r) => r.status === 'Pending')).toBe(true);
    expect(page.hasUnsavedChanges()).toBe(false);
  });
});
