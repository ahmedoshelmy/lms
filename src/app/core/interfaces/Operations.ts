/** The days of the week, as the server names them. */
export type WeekDay =
  | 'Saturday'
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday';

/** The week in the order the school runs it. */
export const WEEK: WeekDay[] = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

/** A class still owed a register. */
export interface OutstandingSession {
  sessionId: number;
  sessionNumber: number;
  topic: string;
  groupName?: string | null;
  courseTitle?: string | null;
  instructorId: number;
  instructorName: string;
  startsAt: string;
  endsAt: string;

  /** How many children could be marked, which is never nought here. */
  studentsOnRoll: number;

  /**
   * Whether the register window has closed, so it will be recorded as taken
   * late. Said plainly: somebody about to be marked late should know it before
   * they decide what to do.
   */
  late: boolean;
}

/** An instructor's word that a class did not happen. */
export interface SessionClaim {
  id: number;
  sessionId: number;
  sessionNumber: number;
  topic: string;
  groupName?: string | null;
  startsAt: string;
  endsAt: string;

  raisedBy: number;
  raisedByName: string;
  reason: string;
  createdAt: string;

  status: 'Pending' | 'Accepted' | 'Rejected';
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

/** What the signed-in person is being stopped about. */
export interface OutstandingWork {
  /** Classes they taught that still have no register. */
  myRegisters: OutstandingSession[];

  /** Claims waiting on them to decide. Operations only. */
  claimsToAnswer: SessionClaim[];

  /** Classes on their days that nobody has marked. Operations only. */
  registersOnMyDays: OutstandingSession[];

  isOperations: boolean;
  myDays: WeekDay[];

  /** Whether anything here needs dealing with, decided on the server. */
  any: boolean;
}

export interface OperationsRotaEntry {
  userId: number;
  name: string;
  days: WeekDay[];
}

export interface OperationsRota {
  admins: OperationsRotaEntry[];

  /**
   * Days nobody has been given. Work for an unowned day goes to every admin,
   * which is safe but is not what whoever drew the rota up meant to happen.
   */
  daysWithoutAnOwner: WeekDay[];
}

/** Whose doing a cancellation was. */
export type CancellationCauseName = 'Instructor' | 'Parents' | 'Holiday';
