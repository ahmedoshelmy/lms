/**
 * The sales side of the schedule: hours held while they are sold, the people
 * being sold to, and the handover to operations.
 */

export type SlotHoldStatus = 'Held' | 'Converted' | 'Released' | 'Expired';

export type CandidateStatus =
  | 'New'
  | 'Contacted'
  | 'TrialBooked'
  | 'Committed'
  | 'Enrolled'
  | 'Lost';

/** In pipeline order, which is how the board reads left to right. */
export const CANDIDATE_STATUSES: CandidateStatus[] = [
  'New',
  'Contacted',
  'TrialBooked',
  'Committed',
  'Enrolled',
  'Lost',
];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  New: 'New',
  Contacted: 'Contacted',
  TrialBooked: 'Trial booked',
  Committed: 'Committed',
  Enrolled: 'Enrolled',
  Lost: 'Lost',
};

/** A free weekly hour, as the slot engine reports it. */
export interface AvailableSlot {
  instructorId: number;
  instructorName: string;
  /** A name such as "Tuesday" on the wire; use toDayNumber before comparing. */
  dayOfWeek: number | string;
  startTime: string;
  endTime: string;
  roomId: number | null;
  roomName: string | null;
  firstDate: string;
  weeksFree: number;
  weeksChecked: number;
  blockers: { date: string; reason: string }[];
}

export interface SlotSearch {
  fromDate?: string;
  weeks?: number;
  instructorId?: number;
  dayOfWeek?: number;
  roomId?: number;
  maxBlockedWeeks?: number;
}

export interface SlotHoldSchedule {
  dayOfWeek: number | string;
  startTime: string;
  endTime: string;
}

export interface SlotHold {
  id: number;
  status: SlotHoldStatus;
  createdBySalesId: number;
  createdBySalesName: string | null;
  instructorId: number;
  instructorName: string | null;
  topicId: number;
  topicName: string | null;
  courseLevelId: number | null;
  courseLevelTitle: string | null;
  roomId: number | null;
  roomName: string | null;
  proposedStartDate: string;
  totalSessions: number;
  expiresAt: string;
  notes: string | null;
  schedules: SlotHoldSchedule[];
  candidates: Candidate[];
  convertedGroupId: number | null;
  outcomeNote: string | null;
  createdAt: string;
  committedCount: number;
  /** Negative once it has lapsed, which is how the list flags it. */
  daysUntilExpiry: number;
  endDate: string;
}

export interface CreateSlotHold {
  instructorId: number;
  topicId: number;
  courseLevelId?: number | null;
  roomId?: number | null;
  proposedStartDate: string;
  totalSessions: number;
  schedules: SlotHoldSchedule[];
  holdForDays?: number | null;
  notes?: string | null;
}

export interface Candidate {
  id: number;
  name: string;
  parentName: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  status: CandidateStatus;
  slotHoldId: number | null;
  createdBySalesId: number;
  createdBySalesName: string | null;
  convertedUserId: number | null;
  createdAt: string;
}

export interface UpsertCandidate {
  name: string;
  parentName?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  slotHoldId?: number | null;
  status?: CandidateStatus;
}
