import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Candidate, SlotHold } from '../../core/interfaces/Sales';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { fromIsoDate } from '../../core/utils/date.utils';
import { SalesComponent } from './sales.component';

/**
 * Trial dates used to be built from local midnight and written out with
 * toISOString(), which is the UTC date -- the day before anywhere east of
 * Greenwich. A Saturday slot offered Fridays.
 */
describe('SalesComponent trial dates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A Tuesday morning.
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        { provide: LmsService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: AuthService, useValue: { hasRole: () => false, getUserId: () => 1 } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  const saturdayHold = {
    id: 1,
    proposedStartDate: '2026-12-05',
    schedules: [{ dayOfWeek: 'Saturday' }],
  } as unknown as SlotHold;

  it('offers only the days the held slot runs on', () => {
    const sales = TestBed.createComponent(SalesComponent).componentInstance;

    sales.openTrialDialog(saturdayHold, { id: 9 } as Candidate);

    expect(sales.trialDate()).toBe('2026-11-28');
    expect(sales.trialDates().length).toBeGreaterThan(0);
    for (const date of sales.trialDates()) {
      expect(fromIsoDate(date)?.getDay()).toBe(6);
    }
  });
});
