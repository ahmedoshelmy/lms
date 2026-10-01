import { Role } from './Role';

export interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  accessToken?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  title?: string;

  /**
   * Students only: every group they are in now. A child may be learning two
   * things at once, so each place carries its own progress and its own renewal
   * question -- one course can be finishing while the other has just begun.
   */
  groups?: StudentMembership[];
  createdAt?: string;
  /** Instructors only: the most they should teach in a week, in minutes. */
  weeklyCapacityMinutes?: number | null;

  /**
   * When the account was switched off, or null while in use. A deactivated
   * account cannot sign in and is left out of every picker, but keeps its history.
   */
  deactivatedAt?: string | null;

  /** Students only: classes left on whichever of their courses ends soonest. */
  sessionsRemaining?: number | null;

  /**
   * Students only: one of their courses is within two classes of its end, so
   * somebody should ask whether they are carrying on. Worked out from the
   * course, so it appears and clears itself as classes are taught.
   */
  renewalDue?: boolean;

  /** Students only: every renewal now due has been dealt with by a colleague. */
  renewalHandled?: boolean;
}

/** One place a student holds in a group. */
export interface StudentMembership {
  groupId: number;
  groupName: string;
  /** Running, Completed, Stopped or Archived. */
  groupStatus: string;
  sessionsRemaining?: number | null;
  renewalDue: boolean;
  renewalHandled: boolean;
  renewalHandledAt?: string | null;
  renewalHandledByName?: string | null;
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  role: Role;
  /** Students only: a group to put them in. */
  groupId?: number;
  /** Instructors only: the most they should teach in a week, in minutes. */
  weeklyCapacityMinutes?: number | null;
}

export interface UpdateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: Role;
  /** Students only: a group to add them to. Leaving one is its own action. */
  groupId?: number;
  /** Instructors only: the most they should teach in a week, in minutes. */
  weeklyCapacityMinutes?: number | null;
}
