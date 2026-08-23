import { describe, it, expect } from 'vitest';
import { formatClockString, formatMoment } from './clock.utils';

/**
 * Every clock on the site reads through these, so the cases that matter are the
 * ones a naive twelve-hour conversion gets wrong: midday, midnight, and the
 * stored strings that carry seconds.
 */
describe('formatClockString', () => {
  describe('on the 24-hour clock', () => {
    it('trims the seconds off a stored time', () => {
      expect(formatClockString('16:30:00', false)).toBe('16:30');
    });

    it('pads a single-digit hour', () => {
      expect(formatClockString('9:05', false)).toBe('09:05');
    });

    it('pads a single-digit minute', () => {
      expect(formatClockString('09:5', false)).toBe('09:05');
    });
  });

  describe('on the 12-hour clock', () => {
    it('reads the afternoon', () => {
      expect(formatClockString('16:30:00', true)).toBe('4:30 pm');
    });

    it('calls midday noon, not zero', () => {
      // 12 % 12 is 0, which is how midday becomes "0:30 pm".
      expect(formatClockString('12:30', true)).toBe('12:30 pm');
    });

    it('calls midnight twelve, not zero', () => {
      expect(formatClockString('00:15', true)).toBe('12:15 am');
    });

    it('keeps the last minute of the morning in the morning', () => {
      expect(formatClockString('11:59', true)).toBe('11:59 am');
    });

    it('puts the first minute of the afternoon in the afternoon', () => {
      expect(formatClockString('12:00', true)).toBe('12:00 pm');
    });
  });

  describe('when the value is not a time', () => {
    it('shows it rather than an empty cell', () => {
      // A blank looks deliberate; the raw value shows there is a data fault.
      expect(formatClockString('not a time', true)).toBe('not a time');
    });

    it('leaves an impossible hour alone', () => {
      expect(formatClockString('25:00', false)).toBe('25:00');
    });

    it('renders nothing for nothing', () => {
      expect(formatClockString(null, false)).toBe('');
      expect(formatClockString(undefined, true)).toBe('');
      expect(formatClockString('', false)).toBe('');
    });
  });
});

describe('formatMoment', () => {
  const afternoon = new Date(2026, 7, 20, 16, 30);

  it('reads a Date on either clock', () => {
    expect(formatMoment(afternoon, false)).toBe('16:30');
    expect(formatMoment(afternoon, true)).toBe('4:30 pm');
  });

  it('accepts an ISO string', () => {
    expect(formatMoment(afternoon.toISOString(), false)).toBe('16:30');
  });

  it('renders nothing for nothing', () => {
    expect(formatMoment(null, false)).toBe('');
    expect(formatMoment(undefined, false)).toBe('');
  });

  it('renders nothing for a date it cannot parse', () => {
    expect(formatMoment('the fourteenth', false)).toBe('');
  });
});
