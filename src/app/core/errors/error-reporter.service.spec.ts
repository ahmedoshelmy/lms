import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../interfaces/Role';
import { AuthService } from '../services/auth.service';
import {
  ClientErrorReport,
  ERROR_REPORT_URL,
  ErrorReporter,
  MAX_REPORTS_PER_LOAD,
  maskIds,
} from './error-reporter.service';

function reporter(url: string | null) {
  const beacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  TestBed.configureTestingModule({
    providers: [
      { provide: ERROR_REPORT_URL, useValue: url },
      { provide: AuthService, useValue: { currentRole: signal(Role.Instructor) } },
    ],
  });
  return { reporter: TestBed.inject(ErrorReporter), beacon };
}

/** The report a beacon carried. */
async function sent(
  beacon: { mock: { calls: [string, Blob][] } },
  call = 0
): Promise<ClientErrorReport> {
  return JSON.parse(await beacon.mock.calls[call][1].text());
}

describe('ErrorReporter', () => {
  afterEach(() => Reflect.deleteProperty(navigator, 'sendBeacon'));

  it('sends nothing until an address is set', () => {
    const { reporter: r, beacon } = reporter(null);
    r.report(new Error('boom'));
    expect(beacon).not.toHaveBeenCalled();
  });

  it('sends the fault, the page with its ids masked, and the role: nothing personal', async () => {
    history.replaceState(null, '', '/students/21?search=Sara%20Ahmed');
    const { reporter: r, beacon } = reporter('https://api.test/client-errors');

    r.report(new TypeError('x is undefined'));

    expect(beacon.mock.calls[0][0]).toBe('https://api.test/client-errors');
    const report = await sent(beacon);
    expect(report.message).toBe('x is undefined');
    expect(report.path).toBe('/students/:id');
    expect(report.role).toBe('Instructor');
    expect(JSON.stringify(report)).not.toContain('Sara');
    history.replaceState(null, '', '/');
  });

  it('sends the same fault once, and no more than the cap in all', () => {
    const { reporter: r, beacon } = reporter('https://api.test/client-errors');
    const same = new Error('again');
    r.report(same);
    r.report(same);
    expect(beacon).toHaveBeenCalledTimes(1);

    for (let i = 0; i < MAX_REPORTS_PER_LOAD + 5; i++) r.report(new Error(`fault ${i}`));
    expect(beacon).toHaveBeenCalledTimes(MAX_REPORTS_PER_LOAD);
  });

  it('reads a failed promise for what is inside it', async () => {
    const { reporter: r, beacon } = reporter('https://api.test/client-errors');
    r.report({ rejection: new Error('inside') });
    expect((await sent(beacon)).message).toBe('inside');
  });
});

describe('maskIds', () => {
  it('masks numbers and long hex ids, and keeps words', () => {
    expect(maskIds('/evaluations/21/3')).toBe('/evaluations/:id/:id');
    expect(maskIds('/x/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('/x/:id');
    expect(maskIds('/my-kpis')).toBe('/my-kpis');
  });
});
