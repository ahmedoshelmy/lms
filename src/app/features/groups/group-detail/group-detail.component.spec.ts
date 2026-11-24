import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from '../../../core/interfaces/Group';
import { AuthService } from '../../../core/services/auth.service';
import { CertificateService } from '../../../core/services/certificate.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { GroupDetailComponent } from './group-detail.component';

/** A group with one saved course, no location and no classes yet. */
const GROUP = {
  id: 5,
  name: 'Python L1 – Sat',
  status: 'Running',
  startDate: '2026-11-01T00:00:00',
  endDate: null,
  defaultInstructorId: 3,
  location: null,
  schedules: [],
  students: [],
  courses: [
    {
      id: 41,
      courseId: 410,
      courseLevelId: 7,
      title: 'Python Level 1',
      level: 1,
      totalSessions: 12,
      currentSessionNumber: 1,
      status: 'Active',
    },
  ],
} as unknown as Group;

describe('GroupDetailComponent Manage Group dialog', () => {
  let lms: { updateGroup: ReturnType<typeof vi.fn> };
  let notify: { showError: ReturnType<typeof vi.fn>; showSuccess: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    lms = { updateGroup: vi.fn(() => of(GROUP)) };
    notify = { showError: vi.fn(), showSuccess: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LmsService, useValue: lms },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: { hasRole: () => true, getUserId: () => 1 } },
        { provide: CertificateService, useValue: {} },
      ],
    });
  });

  function openManageGroup() {
    const component = TestBed.createComponent(GroupDetailComponent).componentInstance;
    // Not loaded from the server here; the reload after saving is not under test.
    component.loadGroupDetail = () => undefined;
    component.groupId.set(GROUP.id);
    component.group.set(GROUP);
    component.openEditModal();
    return component;
  }

  it('does not fill in a location nobody chose', () => {
    const component = openManageGroup();

    expect(component.formLocation).toBe('');
    expect(component.editScheduleSlots().every((s) => s.location === '')).toBe(true);
  });

  it('saves a group that has no end date yet', () => {
    const component = openManageGroup();

    component.saveGroup();

    expect(notify.showError).not.toHaveBeenCalled();
    expect(lms.updateGroup).toHaveBeenCalledTimes(1);
    expect(lms.updateGroup.mock.calls[0][1].endDate).toBeNull();
  });

  it('sends a saved course to the removal dialog instead of dropping it', () => {
    const component = openManageGroup();

    component.removeCourseFromUnifiedEdit(0);

    expect(component.showRemoveCourseModal()).toBe(true);
    expect(component.editCourseItems().length).toBe(1);
  });
});
