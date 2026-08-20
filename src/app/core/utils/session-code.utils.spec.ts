import { describe, expect, it } from 'vitest';
import { getSessionSequence, getSessionSequenceLabel } from './session-code.utils';

describe('getSessionSequence', () => {
  it('shows the group progress against the course total', () => {
    expect(getSessionSequence({ currentSessionNumber: 4, totalSessions: 12 })).toBe('4/12');
  });

  it('prefers the group progress counter over the raw ordinal', () => {
    // Both are present on a ScheduleSession and can disagree; currentSessionNumber
    // is the one the rest of the app treats as the group's progress.
    expect(
      getSessionSequence({ currentSessionNumber: 4, sessionNumber: 9, totalSessions: 12 })
    ).toBe('4/12');
  });

  it('falls back to the session ordinal when progress is missing', () => {
    expect(getSessionSequence({ sessionNumber: 3, totalSessions: 8 })).toBe('3/8');
  });

  it('drops the total when the course length is unknown', () => {
    expect(getSessionSequence({ currentSessionNumber: 4 })).toBe('4');
    expect(getSessionSequence({ currentSessionNumber: 4, totalSessions: 0 })).toBe('4');
  });

  it('returns nothing for a session outside any course sequence', () => {
    // Standalone trial and makeup sessions have no number; the badge is hidden
    // rather than showing "0".
    expect(getSessionSequence({ totalSessions: 12 })).toBe('');
    expect(getSessionSequence({ currentSessionNumber: 0, sessionNumber: 0 })).toBe('');
    expect(getSessionSequence(null)).toBe('');
    expect(getSessionSequence(undefined)).toBe('');
  });
});

describe('getSessionSequenceLabel', () => {
  it('spells the sequence out for the tooltip', () => {
    expect(getSessionSequenceLabel({ currentSessionNumber: 4, totalSessions: 12 })).toBe(
      'Session 4 of 12'
    );
  });

  it('omits the total when the course length is unknown', () => {
    expect(getSessionSequenceLabel({ currentSessionNumber: 4 })).toBe('Session 4');
  });

  it('returns nothing when there is no sequence', () => {
    expect(getSessionSequenceLabel({})).toBe('');
  });
});
