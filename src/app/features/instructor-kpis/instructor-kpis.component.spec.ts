import { Component, input, model, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KpiService } from '../../core/services/kpi.service';
import { KpiPdfService } from '../../core/services/kpi-pdf.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { KpiMonth } from '../../core/interfaces/InstructorKpi';
import { kpiMonth, kpiRow } from '../../core/utils/kpi-test-data';
import { LoadErrorComponent } from '../../shared/components/load-error/load-error.component';
import { InstructorKpisComponent } from './instructor-kpis.component';

// The dialogs have their own specs.
@Component({ selector: 'app-kpi-override-dialog', template: '' })
class OverrideDialogStub {
  readonly visible = model(false);
  readonly target = input<unknown>(null);
  readonly saving = input(false);
  readonly saved = output<{ value: number; reason: string }>();
  readonly cleared = output<void>();
}
@Component({ selector: 'app-kpi-settings-dialog', template: '' })
class SettingsDialogStub {
  readonly visible = model(false);
  readonly saved = output<unknown>();
}

/** The page's protected members, for driving it as its template would. */
interface Page {
  setMonth(month: string): void;
  openOverride(kpi: unknown, indicator: string): void;
  saveOverride(change: { value: number; reason: string }): void;
  sendToOwner(): Promise<void>;
  settingsOpen(): boolean;
}

function render(month: KpiMonth | 'fail', today = new Date(2026, 11, 2, 10)) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(today);
  const kpis = {
    getMonth: vi.fn(() => (month === 'fail' ? throwError(() => new Error('down')) : of(month))),
    setOverride: vi.fn(),
    approve: vi.fn(),
    sendToOwner: vi.fn(),
  };
  const notify = { showSuccess: vi.fn(), showWarn: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: KpiService, useValue: kpis },
      { provide: KpiPdfService, useValue: { download: vi.fn() } },
      { provide: ConfirmService, useValue: { ask: vi.fn(async () => true) } },
      { provide: NotificationService, useValue: notify },
    ],
  });
  TestBed.overrideComponent(InstructorKpisComponent, {
    set: { imports: [LoadErrorComponent, OverrideDialogStub, SettingsDialogStub] },
  });
  const fixture = TestBed.createComponent(InstructorKpisComponent);
  const el = fixture.nativeElement as HTMLElement;
  const page = fixture.componentInstance as unknown as Page;
  return {
    fixture,
    el,
    page,
    kpis,
    notify,
    buttons: () => [...el.querySelectorAll('button')].map((b) => b.textContent!.trim()),
  };
}

describe('InstructorKpisComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a failed load as a failure, not as a month without instructors', async () => {
    const { fixture, el } = render('fail');
    await fixture.whenStable();

    expect(el.querySelector('app-load-error')).not.toBeNull();
    expect(el.textContent).not.toContain('No instructors taught');
  });

  it('offers approval only once the month is over', async () => {
    // 30 November: November is in review, and its reports are due tomorrow.
    const review = render(kpiMonth(), new Date(2026, 10, 30, 10));
    await review.fixture.whenStable();
    expect(review.el.textContent).toContain('Review is open');
    expect(review.buttons()).not.toContain('Approve the month');
    TestBed.resetTestingModule();

    // 2 December, looking back at November.
    const closed = render(kpiMonth());
    closed.page.setMonth('2026-11');
    await closed.fixture.whenStable();
    expect(closed.buttons()).toContain('Approve the month');
  });

  it('waits for the last registers on the 1st, and says when approval opens', async () => {
    // 1 December: November is over, but its last evening's registers are still open.
    const { fixture, el, page, buttons } = render(kpiMonth(), new Date(2026, 11, 1, 10));
    page.setMonth('2026-11');
    await fixture.whenStable();

    expect(el.textContent).toContain('Last registers still open');
    expect(el.textContent).toContain('approval opens on 2 December');
    expect(buttons()).not.toContain('Approve the month');
  });

  it('opens adjusting with the review on the 29th, not before', async () => {
    const live = render(kpiMonth(), new Date(2026, 10, 28, 10));
    await live.fixture.whenStable();
    expect(live.el.querySelector('button[aria-label^="Adjust"]')).toBeNull();
    TestBed.resetTestingModule();

    const review = render(kpiMonth(), new Date(2026, 10, 29, 10));
    await review.fixture.whenStable();
    expect(review.el.querySelectorAll('button[aria-label^="Adjust"]').length).toBe(3);
  });

  it('freezes an approved month: no adjusting, and a way to reopen it', async () => {
    const { fixture, el, buttons } = render(
      kpiMonth({
        status: 'Approved',
        events: [{ action: 'Approved', byName: 'Sara', at: '2026-12-01T09:00:00Z', reason: null }],
      })
    );
    await fixture.whenStable();

    expect(el.querySelector('button[aria-label^="Adjust"]')).toBeNull();
    expect(buttons()).toContain('Reopen');
    expect(el.textContent).toContain('By Sara');
  });

  it("takes the server's recalculated row after an adjustment", async () => {
    const { fixture, el, page, kpis } = render(kpiMonth(), new Date(2026, 10, 29, 10));
    await fixture.whenStable();
    const adjusted = kpiRow({ overall: 97.5, band: 'Excellent' });
    adjusted.reports = {
      ...adjusted.reports,
      value: 100,
      override: { value: 100, reason: 'Merged reports', byName: 'Sara', at: '' },
    };
    kpis.setOverride.mockReturnValue(of(adjusted));

    page.openOverride(kpiRow(), 'reports');
    page.saveOverride({ value: 100, reason: 'Merged reports' });
    await fixture.whenStable();

    expect(kpis.setOverride).toHaveBeenCalledWith('2026-11', 7, 'reports', {
      value: 100,
      reason: 'Merged reports',
    });
    expect(el.textContent).toContain('97.5%');
    expect(el.textContent).toContain('adjusted');
    expect(el.textContent).toContain('Calculated 80%');
  });

  it("asks for the owner's address before sending, rather than sending nowhere", async () => {
    const month = kpiMonth();
    month.settings.ownerEmail = null;
    const { fixture, page, kpis, notify } = render(month);
    await fixture.whenStable();

    await page.sendToOwner();

    expect(kpis.sendToOwner).not.toHaveBeenCalled();
    expect(notify.showWarn).toHaveBeenCalled();
    expect(page.settingsOpen()).toBe(true);
  });
});
