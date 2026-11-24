import { describe, expect, it } from 'vitest';
import { AttendanceStatus } from '../enums/AttendanceStatus';
import {
  RegisterLine,
  buildRegisterPayload,
  markToApiStatus,
  unmarkedCount,
} from './attendance.utils';

describe('markToApiStatus', () => {
  it('maps every real mark to its server status', () => {
    expect(markToApiStatus('Present')).toBe(AttendanceStatus.Present);
    expect(markToApiStatus('Absent')).toBe(AttendanceStatus.Absent);
    expect(markToApiStatus('Late')).toBe(AttendanceStatus.Late);
    expect(markToApiStatus('Excused')).toBe(AttendanceStatus.Excused);
  });

  it('does not turn an unmarked child into a present one', () => {
    expect(markToApiStatus('Pending')).toBeNull();
  });
});

describe('buildRegisterPayload', () => {
  it('sends every line with its marks when everybody is marked', () => {
    const lines: RegisterLine[] = [
      { studentId: 1, status: 'Present', taskDone: true, assignmentDone: false },
      { studentId: 2, status: 'Absent' },
    ];

    expect(buildRegisterPayload(lines)).toEqual([
      { studentId: 1, status: AttendanceStatus.Present, taskDone: true, assignmentDone: false },
      { studentId: 2, status: AttendanceStatus.Absent, taskDone: null, assignmentDone: null },
    ]);
  });

  it('refuses a register with anybody still unmarked', () => {
    const lines: RegisterLine[] = [
      { studentId: 1, status: 'Present' },
      { studentId: 2, status: 'Pending' },
    ];

    expect(buildRegisterPayload(lines)).toBeNull();
  });

  it('accepts an empty register', () => {
    expect(buildRegisterPayload([])).toEqual([]);
  });
});

describe('unmarkedCount', () => {
  it('counts only the children nobody has marked', () => {
    const lines: RegisterLine[] = [
      { studentId: 1, status: 'Pending' },
      { studentId: 2, status: 'Late' },
      { studentId: 3, status: 'Pending' },
    ];

    expect(unmarkedCount(lines)).toBe(2);
  });
});
