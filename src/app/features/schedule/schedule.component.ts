import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { WeeklyScheduleComponent } from './weekly-schedule/weekly-schedule.component';
import { LmsService, ScheduleSession } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ProgressSpinnerModule,
    WeeklyScheduleComponent,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
              Weekly Schedule
            </h1>
            <button
              pButton
              type="button"
              icon="pi pi-sign-out"
              label="Sign out"
              class="p-button-outlined p-button-secondary p-button-sm cursor-pointer"
              (click)="logout()"
            ></button>
          </div>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">
            Your weekly schedule
          </p>
        </div>

        <!-- Week Navigator -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div
            class="flex items-center justify-between gap-3 bg-[var(--color-surface)] p-2 border border-[var(--color-border)] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
          >
            <button
              pButton
              type="button"
              icon="pi pi-chevron-left"
              class="p-button-text p-button-secondary p-button-sm cursor-pointer"
              (click)="previousWeek()"
              aria-label="Previous week"
            ></button>

            <span
              class="text-sm font-bold text-[var(--color-text-primary)] px-2 min-w-[180px] text-center"
            >
              {{ getWeekRangeString() }}
            </span>

            <button
              pButton
              type="button"
              icon="pi pi-chevron-right"
              class="p-button-text p-button-secondary p-button-sm cursor-pointer"
              (click)="nextWeek()"
              aria-label="Next week"
            ></button>
          </div>
        </div>
      </div>

      <!-- Main Schedule content -->
      @if (loading()) {
        <div class="flex justify-center items-center py-20">
          <p-progressSpinner styleClass="w-12 h-12" strokeWidth="4" />
        </div>
      } @else {
        <app-weekly-schedule [sessions]="sessions()" [currentWeekStart]="currentWeekStart()" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    :host ::ng-deep {
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
  selectedInstructorId = signal<string>('');
  currentWeekStart = signal<Date>(new Date());
  loading = signal(false);

  logout(): void {
    this.lmsService.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  private finishLogout(): void {
    this.auth.logout();
  }

  ngOnInit(): void {
    this.calculateWeekStart();

    const userId = this.auth.getUserId();
    if (userId) {
      this.selectedInstructorId.set(userId);
      this.loadSchedule();
    } else {
      this.notify.showError('Could not determine the current user.');
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

  loadSchedule(): void {
    const userId = this.selectedInstructorId();
    if (!userId) {
      this.sessions.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    const fromDate = new Date(this.currentWeekStart());
    const toDate = new Date(this.currentWeekStart());
    toDate.setDate(toDate.getDate() + 7);

    const url = `${this.lmsService.getApiUrl()}/schedule?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`;

    this.http
      .get<ScheduleSession[]>(url)
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
}
