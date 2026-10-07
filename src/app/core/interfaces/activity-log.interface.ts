export interface ActivityLog {
  id: number;
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  method: string;
  path: string;
  statusCode: number;

  /** What happened, in words. Missing on rows written before the log kept it. */
  summary?: string | null;

  /** What it was about — Group, Session, Person, Topic — and which one. */
  entityType?: string | null;
  entityId?: number | null;

  details?: string;
  createdAt: string;
}

export interface ActivityLogQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  action?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  role?: string;
  method?: string;
  entityType?: string;
  entityId?: number;
  failedOnly?: boolean;
}

/** What there is to filter by, counted from the log itself. */
export interface ActivityFilterOptions {
  actions: string[];
  methods: string[];
  roles: string[];
  people: { id: number; name: string; role?: string | null }[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface RoleActivityCount {
  role: string;
  count: number;
}

export interface DailyActivityCount {
  date: string;
  count: number;
}

export interface ActivityStats {
  totalActivities: number;
  todayActivities: number;
  topActions: ActionCount[];
  activitiesByRole: RoleActivityCount[];
  recentDailyActivity: DailyActivityCount[];
}
