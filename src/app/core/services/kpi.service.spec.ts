import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KpiService } from './kpi.service';
import { LmsService } from './lms.service';

describe('KpiService', () => {
  let http: HttpTestingController;
  let kpis: KpiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LmsService, useValue: { getApiUrl: () => 'https://api.test' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    kpis = TestBed.inject(KpiService);
  });

  afterEach(() => http.verify());

  it('asks for a month by its YYYY-MM', () => {
    kpis.getMonth('2026-11').subscribe();
    expect(http.expectOne('https://api.test/kpis/months/2026-11').request.method).toBe('GET');
  });

  it('puts and deletes an adjustment at the contract’s address', () => {
    const url = 'https://api.test/kpis/months/2026-11/instructors/7/overrides/reports';
    kpis
      .setOverride('2026-11', 7, 'reports', { value: 90, reason: 'Two reports merged' })
      .subscribe();
    const put = http.expectOne(url);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ value: 90, reason: 'Two reports merged' });

    kpis.clearOverride('2026-11', 7, 'reports').subscribe();
    expect(http.expectOne(url).request.method).toBe('DELETE');
  });

  it('sends the reason with a reopening, and the range as parameters', () => {
    kpis.reopen('2026-10', 'A register was corrected').subscribe();
    expect(http.expectOne('https://api.test/kpis/months/2026-10/reopen').request.body).toEqual({
      reason: 'A register was corrected',
    });

    kpis.getHistory(7, '2026-06', '2026-11').subscribe();
    const history = http.expectOne((r) => r.url === 'https://api.test/kpis/instructors/7/history');
    expect(history.request.params.get('from')).toBe('2026-06');
    expect(history.request.params.get('to')).toBe('2026-11');
  });

  it('posts the PDF itself to be sent, with the instructor when there is one', () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    kpis.sendToOwner('2026-11', pdf, 'KPI.pdf', 7).subscribe();
    const body = http.expectOne('https://api.test/kpis/months/2026-11/send').request
      .body as FormData;
    expect(body.get('instructorId')).toBe('7');
    expect((body.get('file') as File).name).toBe('KPI.pdf');
  });
});
