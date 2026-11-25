import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, GroupStudent } from '../../../core/interfaces/Group';
import { Role } from '../../../core/interfaces/Role';
import { User } from '../../../core/interfaces/User';
import { AuthService } from '../../../core/services/auth.service';
import { CertificateService } from '../../../core/services/certificate.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { GroupDetailComponent } from './group-detail.component';

const GROUP = {
  id: 5,
  name: 'Python L1 – Sat',
  status: 'Running',
  startDate: '2026-11-01T00:00:00',
  endDate: null,
  defaultInstructorId: 3,
  schedules: [],
  students: [],
  courses: [],
} as unknown as Group;

const SARA = { id: 21, name: 'Sara Ahmed', email: 'sara@example.test', role: Role.Student } as User;

/**
 * The group page's everyday jobs, ahead of splitting the component (F-09):
 * whatever the split, these have to keep working the same way.
 */
describe('GroupDetailComponent workflows', () => {
  let lms: Record<string, ReturnType<typeof vi.fn>>;
  let notify: Record<string, ReturnType<typeof vi.fn>>;
  let page: GroupDetailComponent;
  let reloads: number;

  beforeEach(() => {
    lms = {
      getStudents: vi.fn(() => of([SARA, { ...SARA, id: 3, name: 'Mona', role: Role.Instructor }])),
      updateUser: vi.fn(() => of({})),
      removeStudentFromGroup: vi.fn(() => of({})),
      updateGroupSchedule: vi.fn(() => of({})),
      cancelUpcomingGroupSessions: vi.fn(() =>
        of({ cancelledCount: 2, substitutesCreated: 2, shiftedCount: 6 })
      ),
    };
    notify = { showError: vi.fn(), showSuccess: vi.fn(), showWarn: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LmsService, useValue: lms },
        { provide: NotificationService, useValue: notify },
        {
          provide: AuthService,
          useValue: { hasRole: () => true, getUserId: () => 1, canAccess: () => true },
        },
        { provide: CertificateService, useValue: {} },
      ],
    });
    page = TestBed.createComponent(GroupDetailComponent).componentInstance;
    reloads = 0;
    // The reloads after each change are counted, not performed.
    page.loadGroupDetail = () => void reloads++;
    page.loadGroupHistory = () => undefined;
    page.loadScheduleSessions = () => undefined;
    page.groupId.set(GROUP.id);
    page.group.set(GROUP);
  });

  it('offers only students to add, and adds the one chosen to this group', () => {
    page.openAddStudentModal();
    expect(page.allSystemStudents().map((u) => u.id)).toEqual([21]);

    page.selectStudentToAdd(SARA);
    page.confirmAddStudent();

    expect(lms['updateUser']).toHaveBeenCalledWith(21, {
      name: 'Sara Ahmed',
      email: 'sara@example.test',
      role: Role.Student,
      groupId: 5,
    });
    expect(page.showAddStudentModal()).toBe(false);
    expect(reloads).toBe(1);
  });

  it('removes a student only from this group, and shows the group again', () => {
    page.openRemoveStudentModal({ studentId: 21, studentName: 'Sara Ahmed' } as GroupStudent);
    page.confirmRemoveStudent();

    expect(lms['removeStudentFromGroup']).toHaveBeenCalledWith(5, 21);
    expect(page.showRemoveStudentModal()).toBe(false);
    expect(reloads).toBe(1);
  });

  it('will not save a week with no class in it', () => {
    page.editScheduleSlots.set([]);
    page.saveSchedule();

    expect(lms['updateGroupSchedule']).not.toHaveBeenCalled();
    expect(notify['showError']).toHaveBeenCalled();
  });

  it('saves the weekly slots, leaving out a location nobody gave', () => {
    page.editScheduleSlots.set([
      { dayOfWeek: 'Saturday', startTime: '10:00', endTime: '11:30', location: '' },
    ] as never);
    page.editScheduleUpdateUpcoming.set(true);

    page.saveSchedule();

    expect(lms['updateGroupSchedule']).toHaveBeenCalledWith(5, {
      schedules: [
        { dayOfWeek: 'Saturday', startTime: '10:00', endTime: '11:30', location: undefined },
      ],
      updateUpcomingSessions: true,
    });
  });

  describe('pausing the group', () => {
    beforeEach(() => page.openHoldModal());

    it('pauses a number of classes, and not fewer than one', () => {
      page.holdCount.set(0);
      page.submitHoldGroup();
      expect(lms['cancelUpcomingGroupSessions']).not.toHaveBeenCalled();

      page.holdCount.set(2);
      page.submitHoldGroup();
      expect(lms['cancelUpcomingGroupSessions']).toHaveBeenCalledWith(5, {
        reason: 'Holiday / Vacation Break',
        count: 2,
      });
    });

    it('pauses until a date', () => {
      page.holdMode.set('untilDate');
      page.holdUntilDate.set('2026-12-20');
      page.submitHoldGroup();

      expect(lms['cancelUpcomingGroupSessions']).toHaveBeenCalledWith(5, {
        reason: 'Holiday / Vacation Break',
        holdUntilDate: '2026-12-20',
      });
    });

    it('stops it with no end, and does not report that as missing substitutes', () => {
      page.holdMode.set('indefinite');
      page.submitHoldGroup();

      expect(lms['cancelUpcomingGroupSessions']).toHaveBeenCalledWith(5, {
        reason: 'Holiday / Vacation Break',
        indefinite: true,
      });
      const message = notify['showSuccess'].mock.calls[0][0] as string;
      expect(message).toContain('is stopped');
      expect(message).not.toContain('substitute');
    });
  });
});
