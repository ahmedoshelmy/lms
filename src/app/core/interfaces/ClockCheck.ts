/**
 * What a check of the timetable against the clock found.
 *
 * Egypt moves its clocks twice a year. A class is stored as a moment, but the
 * hour a group meets at is a wall-clock fact — 18:30 is 18:30 in July and in
 * January — so the two can come apart, and did: fourteen classes were sitting
 * an hour early in November 2026. The weekly slot is the authority, because it
 * holds a plain day and time that no clock change can move.
 */
export interface ClockCheckItem {
  sessionId: number;
  sessionNumber: number;
  groupName: string;

  /** The day it falls on, Cairo time: "Mon 2 Nov". */
  day: string;

  /** The hour it currently reads: "17:30". */
  reads: string;

  /** The hour its weekly slot says: "18:30". */
  should: string;

  /** How far out, in minutes. Negative when the class is early. */
  minutesOut: number;

  /**
   * Every one of the group's classes disagrees with its slot, which usually
   * means the slot is what is wrong. These are left unticked.
   */
  slotLooksWrong: boolean;
}

export interface ClockCheck {
  outOfStep: ClockCheckItem[];
  checked: number;
  offPattern: number;
  summerTime: boolean;
  nextChange: string | null;
}
