import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { User } from '../../../../core/interfaces/User';
import { DailyScheduleMatrixComponent } from './daily-schedule-matrix.component';

describe('DailyScheduleMatrixComponent', () => {
  it('opens a class from a link, in the hour it starts and the hour it runs on into', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DailyScheduleMatrixComponent);
    const at = (h: number, m = 0) => new Date(2026, 10, 28, h, m).toISOString();
    fixture.componentRef.setInput('instructors', [{ id: 7, name: 'Mona' } as User]);
    fixture.componentRef.setInput('selectedDate', new Date(2026, 10, 28));
    fixture.componentRef.setInput('sessions', [
      {
        id: 12,
        instructorId: 7,
        groupName: 'Blue Whales',
        startsAt: at(10),
        endsAt: at(11, 30),
        status: 'Scheduled',
      },
    ] as ScheduleSession[]);
    await fixture.whenStable();

    // Links rather than clickable boxes: Tab reaches them, Enter opens them.
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a[href="/sessions/12"]');
    expect(links.length).toBe(2);
    expect(links[1].textContent?.trim()).toBe('continues');
  });
});
