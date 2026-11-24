import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Certificate } from '../../core/interfaces/Certificate';
import { StudentDetails } from '../../core/interfaces/StudentDetails';
import { AuthService } from '../../core/services/auth.service';
import { CertificatePdfService } from '../../core/services/certificate-pdf.service';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { MyLearningComponent } from './my-learning.component';

const course = (id: number, title: string) => ({
  groupCourseId: id,
  title,
  topic: '',
  level: '1',
  currentSessionNumber: 4,
  totalSessions: 12,
  isCompleted: false,
  completedAt: null,
});

const RECORD = {
  attendanceHistory: [],
  groupHistory: [
    {
      groupId: 1,
      groupName: 'Python L1 – Sat',
      instructorName: 'Mona',
      leftAt: null,
      courses: [course(11, 'Python L1')],
    },
    {
      groupId: 2,
      groupName: 'Robotics L2 – Mon',
      instructorName: 'Ali',
      leftAt: null,
      courses: [course(21, 'Robotics L2')],
    },
    {
      groupId: 3,
      groupName: 'Old group',
      instructorName: 'Sara',
      leftAt: '2026-01-01',
      courses: [course(31, 'Scratch')],
    },
  ],
} as unknown as StudentDetails;

describe('MyLearningComponent for a student in two groups', () => {
  it('shows the courses of every group they are in now, and names both', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LmsService,
          useValue: {
            getMyStudentRecord: () => of(RECORD),
            getStudentSessionSummaries: () => of([]),
          },
        },
        { provide: AuthService, useValue: { getUserId: () => 4, currentUser: () => null } },
        { provide: NotificationService, useValue: {} },
        { provide: CertificatePdfService, useValue: {} },
      ],
    });
    const page = TestBed.createComponent(MyLearningComponent);
    page.detectChanges();

    const titles = page.componentInstance.courses().map((r) => r.course.title);
    expect(titles).toEqual(['Python L1', 'Robotics L2']);
    expect(page.componentInstance.groupsLine()).toBe(
      'Python L1 – Sat · Mona and Robotics L2 – Mon · Ali'
    );
  });

  it("puts the course's own group on its certificate, not the first group", async () => {
    TestBed.resetTestingModule();
    const save = vi.fn<(certificates: Certificate[]) => Promise<void>>(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LmsService,
          useValue: {
            getMyStudentRecord: () => of({ ...RECORD, id: 4, name: 'Laila', email: 'l@x' }),
            getStudentSessionSummaries: () => of([]),
          },
        },
        { provide: AuthService, useValue: { getUserId: () => 4, currentUser: () => null } },
        { provide: NotificationService, useValue: { showSuccess: () => {}, showError: () => {} } },
        { provide: CertificatePdfService, useValue: { save } },
      ],
    });
    const page = TestBed.createComponent(MyLearningComponent);
    page.detectChanges();

    const robotics = page.componentInstance.courses()[1];
    page.componentInstance.downloadCertificate({ ...robotics, earned: true });
    await Promise.resolve();

    const [certificate] = save.mock.calls[0][0];
    expect(certificate.groupId).toBe(2);
    expect(certificate.groupName).toBe('Robotics L2 – Mon');
    expect(certificate.key).toBe('2-21');
  });
});
