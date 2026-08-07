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
      next: (res) => {
        this.stats.set(res);
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
        next: (res) => {
          this.logs.set(res.items);
          this.totalRecords.set(res.totalCount);
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
