import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../../../core/interfaces/Role';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SessionDetailComponent } from './session-detail.component';

const SESSION = {
  id: 7,
  topic: 'Loops',
  groupName: 'Python L1 – Sat',
  instructorId: 3,
  instructorName: 'Mona',
  startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  endsAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  durationMinutes: 90,
  status: 'Scheduled',
  attendances: [
    {
      id: 1,
      studentId: 21,
      studentName: 'Sara Ahmed',
      studentEmail: 'sara@example.com',
      status: 1,
    },
    { id: 2, studentId: 22, studentName: 'Omar Ali', studentEmail: 'omar@example.com', status: 2 },
  ],
} as unknown as ScheduleSession;

/**
 * Students can open a session page. They used to get the whole register --
 * every child's name, email and mark -- with the buttons to change it.
 */
describe('SessionDetailComponent for a student', () => {
  let role: Role;
  let userId: number;

  beforeEach(() => {
    role = Role.Student;
    userId = 21;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } },
        },
        {
          provide: LmsService,
          useValue: {
            getSessionDetails: () => of(SESSION),
            getSessionTrials: () => of([]),
            getSessionSyllabus: () => of(null),
            getInstructors: () => of([]),
          },
        },
        { provide: NotificationService, useValue: {} },
        {
          provide: AuthService,
          useValue: { hasRole: (r: Role) => r === role, getUserId: () => userId },
        },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows a student their own mark and nobody else', () => {
    const text = render();

    expect(text).toContain('Your attendance');
    expect(text).toContain('Present');
    expect(text).not.toContain('Omar Ali');
    expect(text).not.toContain('omar@example.com');
    expect(text).not.toContain('Save Attendance');
  });

  it('still shows the instructor the whole register', () => {
    role = Role.Instructor;
    userId = 3;

    const text = render();

    expect(text).toContain('Sara Ahmed');
    expect(text).toContain('Omar Ali');
    expect(text).toContain('Save Attendance');
  });

  it('counts marks typed into the register and not saved as unsaved work', () => {
    role = Role.Instructor;
    userId = 3;
    const fixture = TestBed.createComponent(SessionDetailComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;

    expect(page.hasUnsavedChanges()).toBe(false);

    page.setStatus(page.records()[1], 'Late');

    expect(page.hasUnsavedChanges()).toBe(true);
  });
});
