export interface ActivityLog {
  id: number;
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  method: string;
  path: string;
  statusCode: number;
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
