import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  EVALUATION_SECTIONS,
  EvaluationMetric,
  MonthlyEvaluation,
} from '../../../core/interfaces/MonthlyEvaluation';
import { Role } from '../../../core/interfaces/Role';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { MonthlyReportPdfService } from '../../../core/services/monthly-report-pdf.service';
import { NotificationService } from '../../../core/services/notification.service';
import { EvaluationDetailComponent } from './evaluation-detail.component';

const METRICS: EvaluationMetric[] = EVALUATION_SECTIONS.flatMap((s) =>
  s.metrics.map((m) => m.metric)
);

function report(overrides: Partial<MonthlyEvaluation> = {}): MonthlyEvaluation {
  return {
    id: 40,
    studentId: 21,
    studentName: 'Sara',
    registeredStudentName: 'Sara Ahmed',
    groupId: 3,
    groupName: 'Python L1 – Sat',
    courseName: 'Python',
    courseLevel: 'L1',
    instructorId: 3,
    instructorName: 'Mona',
    month: '2026-10-01',
    status: 'Draft',
    technicalOverview: null,
    attendanceRate: 75,
    tasksRate: 50,
    assignmentsRate: 100,
    attendanceRateEdited: false,
    tasksRateEdited: false,
    assignmentsRateEdited: false,
    recommendations: null,
    ratings: METRICS.map((metric) => ({ metric, stars: 0 })),
    sessions: [
      { sessionId: 101, sessionNumber: 1, date: '2026-10-03', title: 'Loops', included: true },
      { sessionId: 102, sessionNumber: 2, date: '2026-10-10', title: 'Lists', included: false },
    ],
    attendance: {
      classesHeld: 4,
      present: 3,
      late: 0,
      absent: 1,
      excused: 0,
      notMarked: 0,
      tasksAsked: 2,
      tasksDone: 1,
      assignmentsAsked: 1,
      assignmentsDone: 1,
    },
    ...overrides,
  };
}

/** The page's protected members, driven as its template would. */
interface Page {
  setStars(metric: EvaluationMetric, stars: number): void;
  starsFor(metric: EvaluationMetric): number;
  toggleSession(id: number): void;
  studentName: { set(v: string): void };
  overview: { set(v: string): void };
  save(submit: boolean): void;
  release(): void;
  hasUnsavedChanges(): boolean;
}

function render(opts: { load?: () => unknown; role?: Role; saved?: MonthlyEvaluation } = {}) {
  const role = opts.role ?? Role.Instructor;
  const lms = {
    getEvaluation: vi.fn(opts.load ?? (() => of(report()))),
    saveEvaluation: vi.fn<(payload: unknown) => unknown>(() => of(opts.saved ?? report())),
    releaseEvaluation: vi.fn(() => of(report({ status: 'Released' }))),
  };
  const notify = { showSuccess: vi.fn(), showWarn: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ studentId: '21', groupId: '3' }),
            queryParamMap: convertToParamMap({ month: '2026-10-01' }),
          },
        },
      },
      { provide: LmsService, useValue: lms },
      { provide: NotificationService, useValue: notify },
      { provide: MonthlyReportPdfService, useValue: { save: vi.fn() } },
      { provide: AuthService, useValue: { hasRole: (r: Role) => r === role } },
    ],
  });
  const fixture = TestBed.createComponent(EvaluationDetailComponent);
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    page: fixture.componentInstance as unknown as Page,
    lms,
    notify,
  };
}

describe('Writing a monthly report', () => {
  it('says so when the report could not be loaded, and offers to try again', () => {
    const { fixture, el, lms } = render({ load: () => throwError(() => new Error('down')) });

    // Used to be a dead end: "could not be opened", and no way to try again.
    expect(el.querySelector('app-load-error')).not.toBeNull();

    lms.getEvaluation.mockReturnValue(of(report()));
    el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
    fixture.detectChanges();
    expect(el.querySelector('app-load-error')).toBeNull();
    expect(lms.getEvaluation).toHaveBeenCalledTimes(2);
  });

  it('will not send a report to operations with a rating missing', () => {
    const { page, lms, notify } = render();
    METRICS.slice(1).forEach((m) => page.setStars(m, 4));

    page.save(true);

    expect(lms.saveEvaluation).not.toHaveBeenCalled();
    expect(notify.showWarn).toHaveBeenCalled();
  });

  it('saves a draft with what is on screen', () => {
    const { page, lms } = render();
    page.setStars('Communication', 5);
    page.toggleSession(102);
    page.overview.set('   ');
    // An emptied name prints the record's name rather than none.
    page.studentName.set('  ');

    page.save(false);

    const sent = lms.saveEvaluation.mock.calls[0][0] as Record<string, unknown>;
    expect(sent['submit']).toBe(false);
    expect(sent['studentName']).toBe('Sara Ahmed');
    expect(sent['technicalOverview']).toBeNull();
    expect(sent['sessionIds']).toEqual([101, 102]);
    expect(sent['ratings']).toContainEqual({ metric: 'Communication', stars: 5 });
  });

  it('takes a star back when the same one is clicked again', () => {
    const { page } = render();
    page.setStars('Collaboration', 3);
    page.setStars('Collaboration', 3);
    expect(page.starsFor('Collaboration')).toBe(0);
  });

  it('will not release over unsaved edits', () => {
    const { page, lms, notify } = render({ role: Role.Admin });
    page.setStars('Communication', 2);

    page.release();

    expect(lms.releaseEvaluation).not.toHaveBeenCalled();
    expect(notify.showWarn).toHaveBeenCalled();
  });

  it("keeps a released report as the parents' copy for the instructor", () => {
    const { page } = render({ load: () => of(report({ status: 'Released' })) });

    page.setStars('Communication', 5);

    expect(page.starsFor('Communication')).toBe(0);
    expect(page.hasUnsavedChanges()).toBe(false);
  });

  it('lets operations correct a released report', () => {
    const { page } = render({ role: Role.Admin, load: () => of(report({ status: 'Released' })) });

    page.setStars('Communication', 5);

    expect(page.hasUnsavedChanges()).toBe(true);
  });
});
