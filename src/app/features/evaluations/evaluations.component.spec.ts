import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonthlyEvaluationSummary } from '../../core/interfaces/MonthlyEvaluation';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { MonthlyReportPdfService } from '../../core/services/monthly-report-pdf.service';
import { NotificationService } from '../../core/services/notification.service';
import { EvaluationsComponent } from './evaluations.component';

type Page = {
  rows: { set(rows: MonthlyEvaluationSummary[]): void };
  month: { set(m: string): void };
  saveAll(): Promise<void>;
};

const row = (id: number, studentId: number) =>
  ({
    id,
    studentId,
    groupId: 5,
    studentName: `Child ${id}`,
    groupName: 'G',
    status: 'Submitted',
  }) as unknown as MonthlyEvaluationSummary;

describe('EvaluationsComponent "save them all"', () => {
  afterEach(() => vi.useRealTimers());

  it('saves every report from the month it started on, even if the month changes', async () => {
    vi.useFakeTimers();
    const months: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LmsService,
          useValue: {
            getEvaluations: () => of([row(1, 11), row(2, 12)]),
            getEvaluation: (_s: number, _g: number, month: string) => {
              months.push(month);
              return of({});
            },
          },
        },
        { provide: AuthService, useValue: { hasRole: () => true, getUserId: () => 1 } },
        { provide: NotificationService, useValue: { showSuccess: vi.fn(), showWarn: vi.fn() } },
        { provide: MonthlyReportPdfService, useValue: { save: () => Promise.resolve() } },
      ],
    });
    const page = TestBed.createComponent(EvaluationsComponent).componentInstance as unknown as Page;
    page.month.set('2026-11');
    page.rows.set([row(1, 11), row(2, 12)]);

    const run = page.saveAll();
    await vi.advanceTimersByTimeAsync(0);
    // Somebody moves to December while the run is between files.
    page.month.set('2026-12');
    await vi.advanceTimersByTimeAsync(1_000);
    await run;

    expect(months).toEqual(['2026-11-01', '2026-11-01']);
  });
});
