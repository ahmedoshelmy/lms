import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutstandingSession, OutstandingWork } from '../../../core/interfaces/Operations';
import { Role } from '../../../core/interfaces/Role';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationCenterService } from '../../../core/services/notification-center.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OperationsService } from '../../../core/services/operations.service';
import { OutstandingWorkComponent } from './outstanding-work.component';

function register(late: boolean): OutstandingSession {
  return {
    sessionId: late ? 2 : 1,
    sessionNumber: 4,
    topic: 'Loops',
    groupName: 'Python L1 – Sat',
    instructorId: 3,
    instructorName: 'Mona',
    startsAt: '2026-11-21T14:00:00Z',
    endsAt: '2026-11-21T15:30:00Z',
    studentsOnRoll: 6,
    late,
  };
}

function workOf(myRegisters: OutstandingSession[]): OutstandingWork {
  return {
    any: true,
    myRegisters,
    claimsToAnswer: [],
    registersOnMyDays: [],
  } as unknown as OutstandingWork;
}

/**
 * The window is meant to be in the way, but never a trap: an instructor sent
 * to a late register used to land on a page that refused them, and the window
 * came straight back.
 */
describe('OutstandingWorkComponent', () => {
  let operations: {
    work: ReturnType<typeof signal<OutstandingWork | null>>;
    workingOn: ReturnType<typeof signal<number | null>>;
    snoozed: ReturnType<typeof signal<boolean>>;
    refresh: () => void;
    doneWorking: () => void;
    startWorkingOn: ReturnType<typeof vi.fn>;
    snooze: () => void;
    clear: ReturnType<typeof vi.fn>;
  };
  let auth: {
    isLoggedIn: () => boolean;
    hasRole: (r: Role) => boolean;
    logout: ReturnType<typeof vi.fn>;
  };
  let role: Role;

  beforeEach(() => {
    role = Role.Instructor;
    operations = {
      work: signal<OutstandingWork | null>(null),
      workingOn: signal<number | null>(null),
      snoozed: signal(false),
      refresh: () => undefined,
      doneWorking: () => undefined,
      startWorkingOn: vi.fn(),
      snooze: () => operations.snoozed.set(true),
      clear: vi.fn(),
    };
    auth = { isLoggedIn: () => true, hasRole: (r) => r === role, logout: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: OperationsService, useValue: operations },
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: {} },
        { provide: NotificationCenterService, useValue: { clear: vi.fn() } },
        { provide: LmsService, useValue: { logout: () => of(undefined) } },
      ],
    });
  });

  function render(registers: OutstandingSession[]) {
    operations.work.set(workOf(registers));
    const fixture = TestBed.createComponent(OutstandingWorkComponent);
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    const button = (label: string) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
        b.textContent?.includes(label)
      );
    return { fixture, text, button };
  }

  it('does not send an instructor to a late register they cannot take', () => {
    const { text, button } = render([register(true)]);

    expect(button('Mark the register')).toBeUndefined();
    expect(text()).toContain('operations will fill it in');
    expect(button("It didn't happen")).toBeDefined();
  });

  it('lets them close it when nothing left is theirs to do', () => {
    const { fixture, text, button } = render([register(true)]);

    button('Close for now')!.click();
    fixture.detectChanges();

    expect(text()).not.toContain('has no register');
  });

  it('stays in the way while there is a register they can take', () => {
    const { button } = render([register(false), register(true)]);

    expect(button('Mark the register')).toBeDefined();
    expect(button('Close for now')).toBeUndefined();
  });

  it('lets operations take a late register themselves', () => {
    role = Role.Admin;
    const { button } = render([register(true)]);

    expect(button('Mark the register')).toBeDefined();
  });

  it('can always sign out from inside it', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { button } = render([register(false)]);

    button('Sign out')!.click();

    expect(auth.logout).toHaveBeenCalled();
    expect(operations.clear).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
