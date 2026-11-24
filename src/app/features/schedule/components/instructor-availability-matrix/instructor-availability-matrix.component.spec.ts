import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Role } from '../../../../core/interfaces/Role';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { User } from '../../../../core/interfaces/User';
import { AuthService } from '../../../../core/services/auth.service';
import { InstructorAvailabilityMatrixComponent } from './instructor-availability-matrix.component';

const someoneElse = { id: 2, name: 'Ali', role: Role.Instructor } as User;
const me = { id: 7, name: 'Mona', role: Role.Instructor } as User;

describe('InstructorAvailabilityMatrixComponent', () => {
  function create(canPick: boolean) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: signal(me) } }],
    });
    const fixture = TestBed.createComponent(InstructorAvailabilityMatrixComponent);
    fixture.componentRef.setInput('instructors', [someoneElse, me]);
    fixture.componentRef.setInput('canPickInstructor', canPick);
    return fixture.componentInstance;
  }

  it('shows an instructor their own week, not the first one in the list', () => {
    expect(create(false).selectedInstructor()?.id).toBe(7);
  });

  it('lets someone who can pick start from the list', () => {
    expect(create(true).selectedInstructor()?.id).toBe(2);
  });

  it('books every hour a class covers, and not the hours of a cancelled one', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: signal(me) } }],
    });
    const fixture = TestBed.createComponent(InstructorAvailabilityMatrixComponent);
    const at = (h: number, m = 0) => new Date(2026, 10, 28, h, m).toISOString();
    fixture.componentRef.setInput('instructors', [me]);
    fixture.componentRef.setInput('sessions', [
      { id: 1, instructorId: 7, startsAt: at(10), endsAt: at(11, 30), status: 'Scheduled' },
      { id: 2, instructorId: 7, startsAt: at(15), endsAt: at(16), status: 'Cancelled' },
    ] as ScheduleSession[]);
    const week = fixture.componentInstance;
    const day = new Date(2026, 10, 28);

    // The second hour of a 90-minute class is taken, not free.
    expect(week.getInstructorSlotState(day, 10).session?.id).toBe(1);
    expect(week.getInstructorSlotState(day, 11).session?.id).toBe(1);
    expect(week.getInstructorSlotState(day, 12).session).toBeUndefined();
    // A cancelled class leaves its hour free.
    expect(week.getInstructorSlotState(day, 15).session).toBeUndefined();
  });
});
