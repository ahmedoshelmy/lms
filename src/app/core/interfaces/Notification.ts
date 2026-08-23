/**
 * Something that happened which this person needs to know about.
 *
 * Written by the thing that happened, never by the client. There is no way to
 * create one from here, and no way to ask for somebody else's.
 */
export type NotificationKind =
  | 'AttendanceMarked'
  | 'SessionScheduled'
  | 'SessionMoved'
  | 'SessionCancelled'
  | 'SummaryPublished'
  | 'TimeOffDecided'
  | 'HoldExpiring'
  | 'ScheduleDigest'
  | 'AttendanceOutstanding'
  | 'ComplianceReport'
  | 'GroupAssigned';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  /** An app route such as `/sessions/12`, or null when nothing is worth opening. */
  linkPath: string | null;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}

/**
 * The list and the badge together. They come from one request so the number on
 * the bell can never disagree with what opening it shows.
 */
export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}

/** What each kind looks like in the list. */
export const NOTIFICATION_ICONS: Record<NotificationKind, string> = {
  AttendanceMarked: 'pi pi-check-circle',
  SessionScheduled: 'pi pi-calendar-plus',
  SessionMoved: 'pi pi-arrow-right-arrow-left',
  SessionCancelled: 'pi pi-times-circle',
  SummaryPublished: 'pi pi-book',
  TimeOffDecided: 'pi pi-verified',
  HoldExpiring: 'pi pi-hourglass',
  ScheduleDigest: 'pi pi-calendar',
  AttendanceOutstanding: 'pi pi-exclamation-circle',
  ComplianceReport: 'pi pi-chart-bar',
  GroupAssigned: 'pi pi-sitemap',
};

/**
 * "just now", "3h ago", "yesterday". A notification is read against how recent
 * it is, not against a calendar, so that is what the list shows.
 */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172_800) return 'yesterday';
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
