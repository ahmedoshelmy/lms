import { describe, expect, it } from 'vitest';
import {
  courseLength,
  courseTotals,
  nextSessionNumber,
  progressPercent,
  sessionsRemaining,
  sessionsTaught,
} from './course-progress.utils';

/**
 * The groups tab and the group's own page reported different numbers for the
 * same group, because each did this arithmetic itself and read
 * `currentSessionNumber` differently. The cases below are the readings that
 * disagreed.
 */
describe('course progress', () => {
  describe('sessionsTaught', () => {
    it('counts what is behind the course, not the session it owes', () => {
      // The groups list summed currentSessionNumber directly and so reported
      // nine taught on a course that had taught eight.
      expect(sessionsTaught({ currentSessionNumber: 9, totalSessions: 12 })).toBe(8);
    });

    it('treats a course that has taught nothing as nothing', () => {
      expect(sessionsTaught({ currentSessionNumber: 0, totalSessions: 12 })).toBe(0);
      expect(sessionsTaught({ currentSessionNumber: 1, totalSessions: 12 })).toBe(0);
    });

    it('gives a finished course credit for all of it', () => {
      // Progress sits one past the length once the last class is delivered.
      expect(sessionsTaught({ currentSessionNumber: 13, totalSessions: 12 })).toBe(12);
      expect(
        sessionsTaught({ currentSessionNumber: 4, totalSessions: 12, isCompleted: true })
      ).toBe(12);
    });

    it('never reports more taught than the course holds', () => {
      expect(sessionsTaught({ currentSessionNumber: 99, totalSessions: 8 })).toBe(8);
    });

    it('falls back to sessionCount when totalSessions is absent', () => {
      expect(courseLength({ sessionCount: 8 })).toBe(8);
      expect(sessionsTaught({ currentSessionNumber: 5, sessionCount: 8 })).toBe(4);
    });
  });

  describe('sessionsRemaining', () => {
    it('counts the session owed now among what is left', () => {
      // A course at 11 of 12 has both 11 and 12 ahead of it.
      expect(sessionsRemaining({ currentSessionNumber: 11, totalSessions: 12 })).toBe(2);
    });

    it('leaves nothing owing once the course is finished', () => {
      expect(sessionsRemaining({ currentSessionNumber: 13, totalSessions: 12 })).toBe(0);
      expect(
        sessionsRemaining({ currentSessionNumber: 6, totalSessions: 12, isCompleted: true })
      ).toBe(0);
    });

    it('owes the whole course when nothing has been taught', () => {
      expect(sessionsRemaining({ currentSessionNumber: 0, totalSessions: 12 })).toBe(12);
    });

    it('cannot judge a course with no length', () => {
      expect(sessionsRemaining({ currentSessionNumber: 4, totalSessions: 0 })).toBe(0);
    });
  });

  describe('nextSessionNumber', () => {
    it('is the one after everything taught', () => {
      expect(nextSessionNumber({ currentSessionNumber: 9, totalSessions: 12 })).toBe(9);
    });

    it('is nothing once the course is done', () => {
      expect(nextSessionNumber({ currentSessionNumber: 13, totalSessions: 12 })).toBeNull();
    });
  });

  describe('across a whole group', () => {
    it('adds up a finished level and one under way', () => {
      const courses = [
        { currentSessionNumber: 13, totalSessions: 12 },
        { currentSessionNumber: 4, totalSessions: 12 },
      ];

      expect(courseTotals(courses)).toEqual({ taught: 15, total: 24 });
      expect(progressPercent(courses)).toBe(63);
    });

    it('is zero for a group with no courses', () => {
      expect(progressPercent([])).toBe(0);
      expect(progressPercent(null)).toBe(0);
      expect(courseTotals(undefined)).toEqual({ taught: 0, total: 0 });
    });

    it('never exceeds a hundred', () => {
      expect(progressPercent([{ currentSessionNumber: 40, totalSessions: 12 }])).toBe(100);
    });
  });
});
