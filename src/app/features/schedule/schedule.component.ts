import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { WeeklyScheduleComponent } from './weekly-schedule/weekly-schedule.component';
import { LmsService, ScheduleSession, Group } from '../../core/services/lms.service';
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
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            Weekly Schedule
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">
            @if (isAdmin) {
              Select a cohort to view their weekly schedule
            } @else {
              Your weekly schedule
            }
          </p>
        </div>

        <!-- Group/Cohort Select (Admin only) & Week Navigator -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          @if (isAdmin) {
            <div class="flex items-center gap-2">
              <label class="text-sm font-semibold text-[var(--color-text-muted)] whitespace-nowrap"
                >Cohort:</label
              >
              <p-select
                [options]="groups"
                [(ngModel)]="selectedGroupId"
                (onChange)="onGroupChange()"
                optionLabel="name"
                optionValue="id"
                placeholder="Select Cohort"
                class="w-[220px]"
                [filter]="true"
                filterBy="name"
              >
              </p-select>
            </div>
          }

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
      @if (loading) {
        <div class="flex justify-center items-center py-20">
          <p-progressSpinner styleClass="w-12 h-12" strokeWidth="4" />
        </div>
      } @else {
        <app-weekly-schedule [sessions]="sessions" [currentWeekStart]="currentWeekStart" />
      }
    </div>
  `,
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

  sessions: ScheduleSession[] = [];
  groups: Group[] = [];
  selectedGroupId: string = '';
  currentWeekStart: Date = new Date();
  loading = false;

  get isAdmin(): boolean {
    return this.auth.hasRole(Role.Admin);
  }

  ngOnInit(): void {
    this.calculateWeekStart();

    if (this.isAdmin) {
      this.loadGroups();
    } else {
      const userId = this.auth.getUserId();
      if (userId) {
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
    this.currentWeekStart = new Date(today.setDate(diff));
    this.currentWeekStart.setHours(0, 0, 0, 0);
  }

  loadGroups(): void {
    this.loading = true;
    this.lmsService.getGroups().subscribe({
      next: (groups) => {
        this.groups = groups;
        if (this.groups.length > 0) {
          // Find group that has a default instructor (not empty/null/zero GUID)
          const defaultGroup = this.groups.find(
            (g) => g.defaultInstructorId && g.defaultInstructorId !== '00000000-0000-0000-0000-000000000000'
          );
          this.selectedGroupId = defaultGroup ? defaultGroup.id : this.groups[0].id;
          this.loadSchedule();
        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        this.notify.showError(`Failed to load cohorts list: ${err.message || 'Server error'}`);
        this.loading = false;
      },
    });
  }

  loadSchedule(): void {
    this.loading = true;
    const fromDate = new Date(this.currentWeekStart);
    const toDate = new Date(this.currentWeekStart);
    toDate.setDate(toDate.getDate() + 7);

    let url = `${this.lmsService.getApiUrl()}/schedule?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`;

    if (this.isAdmin && this.selectedGroupId) {
      url += `&groupId=${this.selectedGroupId}`;
    }

    this.http.get<ScheduleSession[]>(url).subscribe({
      next: (res) => {
        this.sessions = res;
        this.loading = false;
      },
      error: (err) => {
        this.notify.showError(`Failed to load schedule: ${err.message || 'Server error'}`);
        this.loading = false;
      },
    });
  }

  onGroupChange(): void {
    this.loadSchedule();
  }

  previousWeek(): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    this.currentWeekStart = newDate;
    this.loadSchedule();
  }

  nextWeek(): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    this.currentWeekStart = newDate;
    this.loadSchedule();
  }

  getWeekRangeString(): string {
    const start = new Date(this.currentWeekStart);
    const end = new Date(this.currentWeekStart);
    end.setDate(end.getDate() + 6);

    const formatOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
  }
}
