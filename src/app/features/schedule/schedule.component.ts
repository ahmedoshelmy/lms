import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { WeeklyScheduleComponent } from './weekly-schedule/weekly-schedule.component';
import { SessionDetailPanelComponent } from './session-detail-panel/session-detail-panel.component';
import { LmsService, ScheduleSession, User } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Role } from '../../core/interfaces/Role';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    SelectModule,
    ProgressSpinnerModule,
    WeeklyScheduleComponent,
    SessionDetailPanelComponent,
  ],
  templateUrl: './schedule.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    :host ::ng-deep {
      .p-select {
        border-radius: 10px;
        border-color: var(--color-border);
      }
      .p-button {
        border-radius: 10px;
      }
    }
  `,
})
export class ScheduleComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  sessions = signal<ScheduleSession[]>([]);
  instructors = signal<User[]>([]);
  selectedInstructorId = signal<string>('');
  currentWeekStart = signal<Date>(new Date());
  loading = signal(false);
  selectedSession = signal<ScheduleSession | null>(null);

  get isAdmin(): boolean {
    return this.auth.hasRole(Role.Admin);
  }

  get totalSessionsThisWeek(): number {
    return this.sessions().length;
  }

  private readonly router = inject(Router);

  private finishLogout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    this.calculateWeekStart();

    if (this.isAdmin) {
      this.loadInstructors();
    } else {
      const userId = this.auth.getUserId();
      if (userId) {
        this.selectedInstructorId.set(userId);
        this.loadSchedule();
      } else {
        this.notify.showError('Could not determine the current user.');
      }
    }
  }

  calculateWeekStart(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const saturdayOffset = (dayOfWeek + 1) % 7;
    const diff = today.getDate() - saturdayOffset;
    const weekStart = new Date(today.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    this.currentWeekStart.set(weekStart);
  }

  goToCurrentWeek(): void {
    this.calculateWeekStart();
    this.loadSchedule();
  }

  loadInstructors(): void {
    this.loading.set(true);
    this.lmsService.getUsers().subscribe({
      next: (users) => {
        const filtered = (users || []).filter((u) => u.role === Role.Instructor);
        this.instructors.set(filtered);
        if (filtered.length > 0) {
          this.selectedInstructorId.set(filtered[0].id);
          this.loadSchedule();
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.notify.showError(`Failed to load instructors list: ${err.message || 'Server error'}`);
        this.loading.set(false);
      },
    });
  }

  loadSchedule(): void {
    const instructorId = this.selectedInstructorId();
    if (!instructorId) {
      this.sessions.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    const fromDate = new Date(this.currentWeekStart());
    const toDate = new Date(this.currentWeekStart());
    toDate.setDate(toDate.getDate() + 7);

    // For admin-selected instructors we override X-User-Id explicitly.
    // For other roles the userIdInterceptor already attaches the user's own id.
    const isOwnSchedule = !this.isAdmin;
    const url = `${this.lmsService.getApiUrl()}/schedule?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`;

    this.http
      .get<ScheduleSession[]>(url, isOwnSchedule ? {} : { headers: { 'X-User-Id': instructorId } })
      .subscribe({
        next: (res) => {
          this.sessions.set(res || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.showError(`Failed to load schedule: ${err.message || 'Server error'}`);
          this.loading.set(false);
        },
      });
  }

  onInstructorChange(): void {
    this.loadSchedule();
  }

  previousWeek(): void {
    const newDate = new Date(this.currentWeekStart());
    newDate.setDate(newDate.getDate() - 7);
    this.currentWeekStart.set(newDate);
    this.loadSchedule();
  }

  nextWeek(): void {
    const newDate = new Date(this.currentWeekStart());
    newDate.setDate(newDate.getDate() + 7);
    this.currentWeekStart.set(newDate);
    this.loadSchedule();
  }

  getWeekRangeString(): string {
    const start = new Date(this.currentWeekStart());
    const end = new Date(this.currentWeekStart());
    end.setDate(end.getDate() + 6);

    const formatOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
  }

  onSessionSelected(session: ScheduleSession): void {
    this.selectedSession.set(session);
  }

  onPanelClosed(): void {
    this.selectedSession.set(null);
  }
}
