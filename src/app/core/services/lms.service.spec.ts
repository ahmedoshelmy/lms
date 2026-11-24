import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LmsService } from './lms.service';

const API = 'https://mv-api.inite.tech/api';

/**
 * The exact requests the service sends. Written against the hand-built query
 * strings before they moved to HttpParams, so the move could not quietly
 * change what the server receives.
 */
describe('LmsService requests', () => {
  let lms: LmsService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    lms = TestBed.inject(LmsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function sent(call: () => unknown): string {
    (call() as { subscribe: () => void }).subscribe();
    const req = http.match(() => true);
    expect(req.length).toBe(1);
    return `${req[0].request.method} ${req[0].request.urlWithParams}`;
  }

  it('monthly reports', () => {
    expect(sent(() => lms.getEvaluations('2026-11-01'))).toBe(
      `GET ${API}/evaluations?month=2026-11-01`
    );
    expect(sent(() => lms.getEvaluations('2026-11-01', { instructorId: 3, groupId: 9 }))).toBe(
      `GET ${API}/evaluations?month=2026-11-01&instructorId=3&groupId=9`
    );
    expect(sent(() => lms.getEvaluation(4, 9, '2026-11-01'))).toBe(
      `GET ${API}/evaluations/student/4/group/9?month=2026-11-01`
    );
  });

  it('groups', () => {
    expect(sent(() => lms.suggestGroupName(7))).toBe(`GET ${API}/groups/next-name?courseLevelId=7`);
    expect(sent(() => lms.removeCourseFromGroup(5, 41))).toBe(`DELETE ${API}/groups/5/courses/41`);
    expect(sent(() => lms.removeCourseFromGroup(5, 41, true))).toBe(
      `DELETE ${API}/groups/5/courses/41?confirmDeleteSessions=true`
    );
  });

  it('the schedule and its history', () => {
    const from = new Date(Date.UTC(2026, 10, 21));
    const to = new Date(Date.UTC(2026, 10, 28));
    expect(sent(() => lms.getSchedule())).toBe(`GET ${API}/schedule`);
    expect(sent(() => lms.getSchedule(from, to))).toBe(
      `GET ${API}/schedule?from=2026-11-21T00:00:00.000Z&to=2026-11-28T00:00:00.000Z`
    );
    expect(sent(() => lms.getSessionHistory())).toBe(`GET ${API}/Schedule/history`);
    expect(
      sent(() =>
        lms.getSessionHistory({
          groupId: 5,
          instructorId: 3,
          status: 'Completed',
          from: '2026-11-01',
          to: '2026-11-30',
        })
      )
    ).toBe(
      `GET ${API}/Schedule/history?groupId=5&instructorId=3&status=Completed&from=2026-11-01&to=2026-11-30`
    );
    expect(sent(() => lms.getRegisterCompliance('2026-11-01', '2026-12-01'))).toBe(
      `GET ${API}/Attendance/compliance?from=2026-11-01&to=2026-12-01`
    );
  });

  it('availability', () => {
    expect(sent(() => lms.getRooms())).toBe(`GET ${API}/Availability/rooms?includeInactive=false`);
    expect(sent(() => lms.getRooms(true))).toBe(
      `GET ${API}/Availability/rooms?includeInactive=true`
    );
    expect(sent(() => lms.getInstructorAvailability())).toBe(`GET ${API}/Availability/instructors`);
    expect(sent(() => lms.getInstructorAvailability(3, '2026-11-24'))).toBe(
      `GET ${API}/Availability/instructors?instructorId=3&onDate=2026-11-24`
    );
    expect(sent(() => lms.getLeaveSummary(2026, 11))).toBe(
      `GET ${API}/Availability/time-off/summary?year=2026&month=11`
    );
    expect(sent(() => lms.getTimeOff())).toBe(`GET ${API}/Availability/time-off`);
    expect(sent(() => lms.getTimeOff(3, '2026-11-01', '2026-11-30'))).toBe(
      `GET ${API}/Availability/time-off?instructorId=3&from=2026-11-01&to=2026-11-30`
    );
    expect(sent(() => lms.getAvailabilityRequests())).toBe(`GET ${API}/availability/requests`);
    expect(sent(() => lms.getAvailabilityRequests('Pending', 'TimeOff'))).toBe(
      `GET ${API}/availability/requests?status=Pending&type=TimeOff`
    );
  });

  it('availability requests made for somebody else', () => {
    expect(sent(() => lms.requestTimeOff({} as never))).toBe(
      `POST ${API}/availability/requests/time-off`
    );
    expect(sent(() => lms.requestTimeOff({} as never, 3))).toBe(
      `POST ${API}/availability/requests/time-off?instructorId=3`
    );
    expect(sent(() => lms.requestAvailabilityChange({} as never, 3))).toBe(
      `POST ${API}/availability/requests/availability-change?instructorId=3`
    );
  });

  it('sales', () => {
    expect(sent(() => lms.getSlotHolds())).toBe(`GET ${API}/Sales/holds`);
    expect(
      sent(() => lms.getSlotHolds({ status: 'Active' as never, readyOnly: true, mineOnly: true }))
    ).toBe(`GET ${API}/Sales/holds?status=Active&readyOnly=true&mineOnly=true`);
    expect(sent(() => lms.getCandidates())).toBe(`GET ${API}/Sales/candidates`);
    expect(
      sent(() => lms.getCandidates({ holdId: 2, status: 'Lead' as never, mineOnly: true }))
    ).toBe(`GET ${API}/Sales/candidates?holdId=2&status=Lead&mineOnly=true`);
  });

  it('encodes values that are not plain words', () => {
    // A status or type with a space or an ampersand must not split the query.
    expect(sent(() => lms.getAvailabilityRequests('On hold&x=1'))).toBe(
      `GET ${API}/availability/requests?status=On%20hold%26x=1`
    );
  });
});
