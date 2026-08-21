import { describe, expect, it } from 'vitest';
import { getSessionSequence, getSessionSequenceLabel } from './session-code.utils';

describe('getSessionSequence', () => {
  it('shows the session number against the course total', () => {
    expect(getSessionSequence({ sessionNumber: 4, totalSessions: 12 })).toBe('4/12');
  });

  it('uses the number of this session, not the group progress pointer', () => {
    // The API projects currentSessionNumber from GroupCourse, so it is identical
    // on every session of a group course. Using it would stamp the same badge
    // across a whole week of that group's cards.
    expect(
      getSessionSequence({ sessionNumber: 9, currentSessionNumber: 4, totalSessions: 12 })
    ).toBe('9/12');
  });

  it('gives every session of one group course a distinct number', () => {
    const groupCourse = { currentSessionNumber: 4, totalSessions: 12 };
    const week = [5, 6, 7].map((n) => getSessionSequence({ ...groupCourse, sessionNumber: n }));
    expect(week).toEqual(['5/12', '6/12', '7/12']);
  });

  it('falls back to the progress pointer when the session has no number', () => {
    expect(getSessionSequence({ currentSessionNumber: 3, totalSessions: 8 })).toBe('3/8');
  });

  it('drops the total when the course length is unknown', () => {
    expect(getSessionSequence({ sessionNumber: 4 })).toBe('4');
    expect(getSessionSequence({ sessionNumber: 4, totalSessions: 0 })).toBe('4');
  });

  it('returns nothing for a session outside any course sequence', () => {
    // Standalone trial and makeup sessions have no number; the badge is hidden
    // rather than showing "0".
    expect(getSessionSequence({ totalSessions: 12 })).toBe('');
    expect(getSessionSequence({ sessionNumber: 0, currentSessionNumber: 0 })).toBe('');
    expect(getSessionSequence(null)).toBe('');
    expect(getSessionSequence(undefined)).toBe('');
  });
});

describe('getSessionSequenceLabel', () => {
  it('spells the sequence out for the tooltip', () => {
    expect(getSessionSequenceLabel({ sessionNumber: 4, totalSessions: 12 })).toBe(
      'Session 4 of 12'
    );
  });

  it('omits the total when the course length is unknown', () => {
    expect(getSessionSequenceLabel({ sessionNumber: 4 })).toBe('Session 4');
  });

  it('returns nothing when there is no sequence', () => {
    expect(getSessionSequenceLabel({})).toBe('');
  });
});
