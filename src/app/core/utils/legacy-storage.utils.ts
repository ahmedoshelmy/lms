/** Prefix of the per-session register copies older versions kept in the browser. */
const ATTENDANCE_CACHE_PREFIX = 'lms_attendance_';

/**
 * Deletes the register copies older versions left in this browser.
 *
 * Every saved register used to be written to localStorage -- student ids and
 * their marks, never cleared, not even on sign-out -- so on a shared machine
 * the next person could read them. Nothing writes them any more; this removes
 * what is already there. Returns how many were removed.
 */
export function purgeLegacyAttendanceCache(storage: Storage): number {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(ATTENDANCE_CACHE_PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));
  return keys.length;
}
