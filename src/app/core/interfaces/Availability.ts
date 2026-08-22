/**
 * Declared instructor availability, and the requests to change it.
 *
 * Availability used to be assumed by the schedule UI — a flat 09:00-18:00 for
 * everyone, minus booked sessions. It is now recorded, which is what lets a slot
 * be offered to a customer honestly.
 */

/** Sunday is 0, matching both .NET's DayOfWeek and JavaScript's getDay(). */
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface Room {
  id: number;
  name: string;
  branch: string | null;
  /** Sessions that may run here at once. Null means no limit. */
  parallelCapacity: number | null;
  /** Reachable only as a recorded override. */
  overflowCapacity: number | null;
  /** Fixed booking window, where the site works that way. */
  defaultSessionMinutes: number | null;
  studentCapacity: number | null;
  isVirtual: boolean;
  /** A partner site we do not book space at — we supply an instructor only. */
  isExternal: boolean;
  isActive: boolean;
}

export interface InstructorAvailability {
  id: number;
  instructorId: number;
  instructorName: string | null;
  /** A name such as "Tuesday" on the wire; use toDayNumber before comparing. */
  dayOfWeek: number | string;
  /** "HH:mm:ss" from the API. */
  startTime: string;
  endTime: string;
  roomId: number | null;
  roomName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface AvailabilityWindowInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: number | null;
}

export interface InstructorTimeOff {
  id: number;
  instructorId: number;
  instructorName: string | null;
  fromDate: string;
  toDate: string;
  /** Null for a whole day. */
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  conflictingSessionCount: number;
}

// ── Requests ─────────────────────────────────────────────────────────────────

export type AvailabilityRequestType = 'TimeOff' | 'AvailabilityChange' | 'SlotException';
export type AvailabilityRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';

export interface AvailabilityRequestWindow {
  dayOfWeek: number | string;
  startTime: string;
  endTime: string;
  roomId: number | null;
  roomName: string | null;
}

export interface AvailabilityRequest {
  id: number;
  type: AvailabilityRequestType;
  status: AvailabilityRequestStatus;
  requestedById: number;
  requestedByName: string | null;
  instructorId: number;
  instructorName: string | null;
  reason: string;
  fromDate: string | null;
  toDate: string | null;
  startTime: string | null;
  endTime: string | null;
  windows: AvailabilityRequestWindow[];
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  /** Scheduled sessions a requested absence would run into. */
  conflictingSessionCount: number;
}

export interface CreateTimeOffRequest {
  fromDate: string;
  toDate: string;
  startTime?: string | null;
  endTime?: string | null;
  reason: string;
}

export interface CreateAvailabilityChangeRequest {
  windows: AvailabilityWindowInput[];
  fromDate?: string | null;
  reason: string;
}

export interface CreateSlotExceptionRequest {
  instructorId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  reason: string;
}

/** What a request is called on screen, and what it is actually asking for. */
export const REQUEST_TYPE_LABELS: Record<AvailabilityRequestType, string> = {
  TimeOff: 'Time off',
  AvailabilityChange: 'Change of hours',
  SlotException: 'New slot',
};

/** Trims "HH:mm:ss" to "HH:mm"; the seconds are never meaningful here. */
export function shortTime(time: string | null | undefined): string {
  return (time ?? '').slice(0, 5);
}

/**
 * The API serialises enums as names, so DayOfWeek arrives as "Tuesday" rather
 * than 2 — but a number is what every comparison and array index here wants.
 * Accepts either, so the page does not depend on that setting staying put.
 */
export function toDayNumber(day: number | string): number {
  if (typeof day === 'number') return day;
  const index = WEEKDAYS.findIndex((name) => name.toLowerCase() === day.toLowerCase());
  return index >= 0 ? index : Number(day) || 0;
}
