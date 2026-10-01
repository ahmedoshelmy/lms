/**
 * One instructor's week: what they are down to teach, what they said they
 * could teach, and the ceiling somebody set for them.
 *
 * The three were only ever visible apart — hours on the instructor's own page,
 * the windows on the availability tab, the limit nowhere at all — so nobody
 * could see who was full and who had room without opening three screens each.
 */
export interface InstructorWorkload {
  instructorId: number;
  name: string;
  email?: string | null;

  /** Classes on the timetable this week, cancellations excluded. */
  sessionsThisWeek: number;

  /** Hours of class actually booked this week. */
  scheduledHours: number;

  /**
   * Hours a week they have told the availability tab they can teach. Zero
   * when they have set no windows, which is not the same as being free —
   * check {@link hasAvailability} before reading it as capacity.
   */
  availableHours: number;

  /** The most they should be given in a week. Null when nobody set one. */
  capacityHours?: number | null;

  /** Whether they have set any availability windows at all. */
  hasAvailability: boolean;

  /** Every class ever put in their hands, cancelled ones included. */
  totalSessions: number;

  /**
   * Of those, the ones called off because they could not teach. Counted only
   * where somebody said so when cancelling, so it starts at nought for
   * everybody and grows from the day the reason was first asked for.
   */
  cancelledByThem: number;

  /** Those cancellations as a share of everything they were given. */
  cancelledByThemPercent: number;
}
