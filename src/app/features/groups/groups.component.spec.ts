import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GROUP_STATUS } from '../../core/interfaces/Group';
import { Role } from '../../core/interfaces/Role';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { GroupsComponent } from './groups.component';

describe('GroupsComponent creating a group', () => {
  it('starts the new group as Running, a status the API has', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // Every read answers with nothing.
        { provide: LmsService, useValue: new Proxy({}, { get: () => () => of([]) }) },
        { provide: NotificationService, useValue: { showWarn: vi.fn(), showSuccess: vi.fn() } },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 1, role: Role.Admin }), hasRole: () => true },
        },
      ],
    });
    const page = TestBed.createComponent(GroupsComponent).componentInstance;

    page.openCreateModal();

    expect(page.formStatus).toBe(GROUP_STATUS['Running']);
  });
});

describe('GroupsComponent counting what each group has left', () => {
  function render(groups: unknown[]) {
    const getSchedule = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LmsService,
          useValue: new Proxy(
            { getGroups: () => of(groups), getSchedule },
            {
              get: (target, key) =>
                (target as Record<string | symbol, unknown>)[key] ?? (() => of([])),
            }
          ),
        },
        { provide: NotificationService, useValue: { showWarn: vi.fn(), showSuccess: vi.fn() } },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 1, role: Role.Admin }), hasRole: () => true },
        },
      ],
    });
    const page = TestBed.createComponent(GroupsComponent).componentInstance;
    page.loadGroups();
    return { page, getSchedule };
  }

  it("takes the server's count, without downloading the timetable", () => {
    const group = { id: 3, name: 'G', courses: [], upcomingSessions: 7 };
    const { page, getSchedule } = render([group]);

    expect(getSchedule).not.toHaveBeenCalled();
    expect(page.getRemainingSessions(group as never)).toBe(7);
  });

  it('counts from the timetable when an older server does not send the count', () => {
    const { getSchedule } = render([{ id: 3, name: 'G', courses: [] }]);

    expect(getSchedule).toHaveBeenCalledTimes(1);
  });
});
