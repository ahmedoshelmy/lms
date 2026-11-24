import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { WeeklyScheduleComponent } from './weekly-schedule.component';

function session(id: number, instructorId: number, instructorName: string): ScheduleSession {
  return {
    id,
    instructorId,
    instructorName,
    topic: 'Loops',
    courseTitle: 'Python',
    groupName: 'G1',
    startsAt: new Date(2026, 10, 21, 10).toISOString(),
    endsAt: new Date(2026, 10, 21, 11, 30).toISOString(),
    durationMinutes: 90,
    status: 'Scheduled',
  } as ScheduleSession;
}

describe('WeeklyScheduleComponent instructor filter', () => {
  it("shows Ali's classes and not Alia's", () => {
    const fixture = TestBed.createComponent(WeeklyScheduleComponent);
    fixture.componentRef.setInput('sessions', [session(1, 1, 'Ali'), session(2, 2, 'Alia')]);
    fixture.componentRef.setInput('instructorFilter', 'Ali');

    const shown = fixture.componentInstance.filteredSessions().map((s) => s.id);

    expect(shown).toEqual([1]);
  });
});
