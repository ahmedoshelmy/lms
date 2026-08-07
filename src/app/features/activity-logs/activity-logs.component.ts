import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { ActivityLog, ActivityStats } from '../../core/interfaces/activity-log.interface';

@Component({
  selector: 'app-activity-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './activity-logs.component.html',
  styleUrl: './activity-logs.component.scss',
})
export class ActivityLogsComponent implements OnInit {
  private activityLogService = inject(ActivityLogService);

  stats = signal<ActivityStats | null>(null);
  logs = signal<ActivityLog[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(true);
  statsLoading = signal<boolean>(true);

  searchQuery = signal<string>('');
  page = signal<number>(1);
  pageSize = signal<number>(15);

  ngOnInit(): void {
    this.fetchStats();
    this.fetchLogs();
  }

  fetchStats(): void {
    this.statsLoading.set(true);
    this.activityLogService.getActivityStats().subscribe({
      next: (res: any) => {
        if (res) {
          const mappedStats: ActivityStats = {
            totalActivities: res.totalActivities ?? res.TotalActivities ?? 0,
            todayActivities: res.todayActivities ?? res.TodayActivities ?? 0,
            topActions: (res.topActions ?? res.TopActions ?? []).map((x: any) => ({
              action: x.action ?? x.Action,
              count: x.count ?? x.Count
            })),
            activitiesByRole: (res.activitiesByRole ?? res.ActivitiesByRole ?? []).map((x: any) => ({
              role: x.role ?? x.Role,
              count: x.count ?? x.Count
            })),
            recentDailyActivity: (res.recentDailyActivity ?? res.RecentDailyActivity ?? []).map((x: any) => ({
              date: x.date ?? x.Date,
              count: x.count ?? x.Count
            }))
          };
          this.stats.set(mappedStats);
        }
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  fetchLogs(): void {
    this.loading.set(true);
    this.activityLogService
      .getActivityLogs({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.searchQuery().trim() || undefined,
      })
      .subscribe({
        next: (res: any) => {
          const rawItems = res?.items ?? res?.Items ?? [];
          const mappedItems: ActivityLog[] = rawItems.map((x: any) => ({
            id: x.id ?? x.Id,
            userId: x.userId ?? x.UserId,
            userName: x.userName ?? x.UserName,
            userRole: x.userRole ?? x.UserRole,
            action: x.action ?? x.Action,
            method: x.method ?? x.Method,
            path: x.path ?? x.Path,
            statusCode: x.statusCode ?? x.StatusCode,
            details: x.details ?? x.Details,
            createdAt: x.createdAt ?? x.CreatedAt
          }));
          this.logs.set(mappedItems);
          this.totalRecords.set(res?.totalCount ?? res?.TotalCount ?? mappedItems.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.page.set(1);
    this.fetchLogs();
  }

  onPageChange(event: any): void {
    const newPage = Math.floor(event.first / event.rows) + 1;
    this.page.set(newPage);
    this.pageSize.set(event.rows);
    this.fetchLogs();
  }

  getMethodSeverity(method: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'info';
      case 'POST':
        return 'success';
      case 'PUT':
      case 'PATCH':
        return 'warn';
      case 'DELETE':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getStatusSeverity(status: number): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warn';
    if (status >= 500) return 'danger';
    return 'secondary';
  }

  getRoleSeverity(role?: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'danger';
      case 'instructor':
        return 'info';
      case 'student':
        return 'success';
      default:
        return 'secondary';
    }
  }
}
