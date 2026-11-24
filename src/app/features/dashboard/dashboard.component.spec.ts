import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '../../core/interfaces/Role';
import { AuthService } from '../../core/services/auth.service';
import { LmsService } from '../../core/services/lms.service';
import { DashboardComponent } from './dashboard.component';

function start(role: Role) {
  const lms = {
    getSchedule: vi.fn(() => of([])),
    getCourses: vi.fn(() => of([])),
    getAttendanceSummary: vi.fn(() => of(null)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LmsService, useValue: lms },
      { provide: AuthService, useValue: { hasRole: (r: Role) => r === role, getUserId: () => 1 } },
    ],
  });
  TestBed.createComponent(DashboardComponent).componentInstance.ngOnInit();
  return lms;
}

const calls = (lms: ReturnType<typeof start>) =>
  lms.getSchedule.mock.calls.length +
  lms.getCourses.mock.calls.length +
  lms.getAttendanceSummary.mock.calls.length;

describe('DashboardComponent', () => {
  it('loads the instructor view for an instructor', () => {
    expect(calls(start(Role.Instructor))).toBeGreaterThan(0);
  });

  for (const role of [Role.Admin, Role.Sales, Role.Student]) {
    it(`sends nothing for ${Role[role]}, whose overview loads its own data`, () => {
      expect(calls(start(role))).toBe(0);
    });
  }
});
