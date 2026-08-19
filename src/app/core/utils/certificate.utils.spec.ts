import { describe, expect, it } from 'vitest';
import {
  buildCertificateSerial,
  computeDurationWeeks,
  evaluateCertificateEligibility,
} from './certificate.utils';
import { StudentAttendanceRecord } from '../interfaces/StudentDetails';

function record(overrides: Partial<StudentAttendanceRecord> = {}): StudentAttendanceRecord {
  return {
    sessionId: 1,
    topic: 'Loops',
    startsAt: '2026-01-01T10:00:00Z',
    endsAt: '2026-01-01T11:00:00Z',
    sessionStatus: 'Completed',
    attendanceStatus: 'Present',
    courseTitle: 'Python Level 2',
    groupName: 'PY-G01',
    instructorName: 'Ahmed Saeed',
    ...overrides,
  };
}

/** Evaluates against the standard course/group, completed unless stated otherwise. */
function evaluate(attendance: StudentAttendanceRecord[], completed = true) {
  return evaluateCertificateEligibility(
    attendance,
    'Python Level 2',
    'PY-G01',
    attendance.length || 1,
    completed
  );
}

describe('evaluateCertificateEligibility', () => {
  it('passes a completed level at or above the 75% threshold', () => {
    const result = evaluate([
      ...Array.from({ length: 3 }, () => record()),
      record({ attendanceStatus: 'Absent' }),
    ]);

    expect(result.attendanceRate).toBe(75);
    expect(result.attendedSessions).toBe(3);
    expect(result.recordedSessions).toBe(4);
    expect(result.eligible).toBe(true);
    expect(result.failedChecks).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it('counts Late as attended', () => {
    const result = evaluate([record({ attendanceStatus: 'Late' }), record()]);

    expect(result.attendanceRate).toBe(100);
    expect(result.eligible).toBe(true);
  });

  it('flags attendance below the threshold', () => {
    const result = evaluate([
      record(),
      record({ attendanceStatus: 'Absent' }),
      record({ attendanceStatus: 'Absent' }),
      record({ attendanceStatus: 'Excused' }),
    ]);

    expect(result.attendanceRate).toBe(25);
    expect(result.eligible).toBe(false);
    expect(result.failedChecks).toEqual(['attendance']);
    expect(result.reasons[0]).toContain('25%');
    expect(result.reasons[0]).toContain('75%');
  });

  it('flags a level the group has not been marked complete for', () => {
    const result = evaluate([record(), record()], false);

    expect(result.courseCompleted).toBe(false);
    expect(result.attendanceRate).toBe(100);
    expect(result.eligible).toBe(false);
    expect(result.failedChecks).toEqual(['completion']);
    expect(result.reasons[0]).toContain('not marked complete');
  });

  it('reports both failures for a historical cohort with no data at all', () => {
    // The case the bypass exists for: the level was never flagged complete and
    // no attendance was ever entered.
    const result = evaluateCertificateEligibility([], 'Python Level 2', 'PY-G01', 12, false);

    expect(result.eligible).toBe(false);
    expect(result.failedChecks).toEqual(['completion', 'attendance']);
    expect(result.reasons).toHaveLength(2);
    expect(result.attendanceRate).toBe(0);
    expect(result.recordedSessions).toBe(0);
  });

  it('reports no records rather than dividing by zero', () => {
    const result = evaluateCertificateEligibility([], 'Python Level 2', 'PY-G01', 8, true);

    expect(result.attendanceRate).toBe(0);
    expect(result.recordedSessions).toBe(0);
    expect(result.failedChecks).toEqual(['attendance']);
    expect(result.reasons[0]).toBe('No attendance records exist for this course level');
  });

  it('ignores cancelled sessions entirely', () => {
    const result = evaluate([
      record(),
      record({ sessionStatus: 'Cancelled', attendanceStatus: 'Absent' }),
      record({ sessionStatus: 'Cancelled by admin', attendanceStatus: 'Absent' }),
    ]);

    expect(result.recordedSessions).toBe(1);
    expect(result.attendanceRate).toBe(100);
  });

  it('only counts records for the requested course and group', () => {
    const result = evaluate([
      record(),
      record({ courseTitle: 'Python Level 3' }),
      record({ groupName: 'PY-G02' }),
    ]);

    expect(result.recordedSessions).toBe(1);
  });

  it('matches on course alone when a record omits the group name', () => {
    const result = evaluate([record({ groupName: '' })]);

    expect(result.recordedSessions).toBe(1);
    expect(result.eligible).toBe(true);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    const result = evaluate([record({ courseTitle: '  python level 2 ' })]);

    expect(result.recordedSessions).toBe(1);
  });
});

describe('buildCertificateSerial', () => {
  const base = {
    studentId: 45,
    groupId: 12,
    courseTitle: 'Python Level 2',
    topic: 'Python',
    level: 2,
  };

  it('encodes topic, level, group and student', () => {
    expect(buildCertificateSerial(base)).toMatch(/^MV-PY-L2-G12-S45-[0-9A-F]{4}$/);
  });

  it('is stable across calls so a reissue keeps its number', () => {
    expect(buildCertificateSerial(base)).toBe(buildCertificateSerial(base));
  });

  it('differs between students and between courses', () => {
    const other = buildCertificateSerial({ ...base, studentId: 46 });
    const otherCourse = buildCertificateSerial({ ...base, courseTitle: 'Python Level 3' });

    expect(other).not.toBe(buildCertificateSerial(base));
    expect(otherCourse).not.toBe(buildCertificateSerial(base));
  });

  it('stamps M in place of the group for a manual certificate', () => {
    expect(buildCertificateSerial({ ...base, groupId: null })).toMatch(
      /^MV-PY-L2-M-S45-[0-9A-F]{4}$/
    );
  });

  it('gives a manual certificate a different serial from the enrolled one', () => {
    expect(buildCertificateSerial({ ...base, groupId: null })).not.toBe(
      buildCertificateSerial(base)
    );
  });

  it('accepts the string level shape the history endpoint returns', () => {
    expect(buildCertificateSerial({ ...base, level: '2' })).toMatch(/^MV-PY-L2-/);
  });
});

describe('computeDurationWeeks', () => {
  it('treats one session a week as one week per session', () => {
    expect(computeDurationWeeks(8, 1)).toBe(8);
  });

  it('halves the duration when the group sits twice a week', () => {
    expect(computeDurationWeeks(8, 2)).toBe(4);
  });

  it('rounds a part week up', () => {
    expect(computeDurationWeeks(9, 2)).toBe(5);
  });

  it('assumes one session a week when the schedule is unknown', () => {
    expect(computeDurationWeeks(8)).toBe(8);
    expect(computeDurationWeeks(8, null)).toBe(8);
    expect(computeDurationWeeks(8, 0)).toBe(8);
  });

  it('returns null when the session count is unknown, so the clause is hidden', () => {
    expect(computeDurationWeeks(null, 1)).toBeNull();
    expect(computeDurationWeeks(undefined, 1)).toBeNull();
    expect(computeDurationWeeks(0, 1)).toBeNull();
  });
});
