import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { InstructorKpi } from '../../core/interfaces/InstructorKpi';
import { KpiService } from '../../core/services/kpi.service';
import { kpiRow } from '../../core/utils/kpi-test-data';
import { MyKpisComponent } from './my-kpis.component';

function render(rows: InstructorKpi[]) {
  TestBed.configureTestingModule({
    providers: [{ provide: KpiService, useValue: { getMine: () => of(rows) } }],
  });
  const fixture = TestBed.createComponent(MyKpisComponent);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('MyKpisComponent', () => {
  it('shows the latest approved month in full, the earlier ones in the table', async () => {
    const { fixture, el } = render([
      kpiRow({ month: '2026-09', overall: 70 }),
      kpiRow({ month: '2026-10', overall: 88 }),
    ]);
    await fixture.whenStable();

    expect(el.querySelector('h2')?.textContent).toContain('October 2026');
    expect(el.querySelector('tbody')?.textContent).toContain('September 2026');
  });

  it('says why there is nothing yet', async () => {
    const { fixture, el } = render([]);
    await fixture.whenStable();
    expect(el.textContent).toContain('No approved months yet');
  });
});
