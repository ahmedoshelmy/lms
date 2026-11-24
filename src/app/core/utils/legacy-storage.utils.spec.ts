import { afterEach, describe, expect, it } from 'vitest';
import { purgeLegacyAttendanceCache } from './legacy-storage.utils';

describe('purgeLegacyAttendanceCache', () => {
  afterEach(() => localStorage.clear());

  it('removes every cached register and leaves everything else', () => {
    localStorage.setItem('lms_attendance_12', '{"5":{"status":"Present"}}');
    localStorage.setItem('lms_attendance_13', '{}');
    localStorage.setItem('auth_user', '{"id":1}');
    localStorage.setItem('lms_theme', 'dark');

    expect(purgeLegacyAttendanceCache(localStorage)).toBe(2);

    expect(localStorage.getItem('lms_attendance_12')).toBeNull();
    expect(localStorage.getItem('lms_attendance_13')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBe('{"id":1}');
    expect(localStorage.getItem('lms_theme')).toBe('dark');
  });
});
