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
  groupName?: string;
  groupId?: number;
  createdAt?: string;
  /** Instructors only: the most they should teach in a week, in minutes. */
  weeklyCapacityMinutes?: number | null;

  /** Students only: classes left on the course they are taking. */
  sessionsRemaining?: number | null;

  /**
   * Students only: their course is within two classes of its end, so somebody
   * should ask whether they are carrying on. Worked out from the course, so it
   * appears and clears itself as classes are taught.
   */
  renewalDue?: boolean;

  /** Students only: a colleague has already had that conversation. */
  renewalHandled?: boolean;
  renewalHandledAt?: string | null;
  renewalHandledByName?: string | null;
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  role: Role;
  groupId?: number;
}

export interface UpdateUserPayload {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: Role;
  groupId?: number;
}
