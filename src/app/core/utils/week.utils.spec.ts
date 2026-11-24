import { describe, expect, it } from 'vitest';
import { isSameSchoolWeek, startOfSchoolWeek } from './week.utils';

// Saturday 21 November 2026 to Friday 27 November 2026 is one school week.
const day = (d: number, h = 10) => new Date(2026, 10, d, h, 0, 0);

describe('startOfSchoolWeek', () => {
  it('starts every day of the week on its Saturday, at midnight', () => {
    for (let d = 21; d <= 27; d++) {
      const start = startOfSchoolWeek(day(d));
      expect(start.getDate()).toBe(21);
      expect(start.getDay()).toBe(6);
      expect(start.getHours()).toBe(0);
    }
  });

  it('puts the next Saturday in the next week', () => {
    expect(startOfSchoolWeek(day(28)).getDate()).toBe(28);
  });
});

describe('isSameSchoolWeek', () => {
  it('keeps Saturday and the following Monday together', () => {
    // A Monday-based week used to split these, treating the move as a
    // move into next week.
    expect(isSameSchoolWeek(day(21), day(23))).toBe(true);
  });

  it('separates a Friday from the Saturday after it', () => {
    expect(isSameSchoolWeek(day(27, 23), day(28, 0))).toBe(false);
  });
});
