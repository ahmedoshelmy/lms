import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { WeeklyScheduleComponent } from './weekly-schedule/weekly-schedule.component';
import { LmsService, ScheduleSession, User } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, SelectModule, ProgressSpinnerModule, WeeklyScheduleComponent],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Weekly Schedule</h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">Select an instructor to view their weekly schedule</p>
        </div>

        <!-- Instructor Select & Week Navigator -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-sm font-semibold text-[var(--color-text-muted)] whitespace-nowrap">Instructor:</label>
            <p-select 
              [options]="instructors" 
              [(ngModel)]="selectedInstructorId" 
              (onChange)="onInstructorChange()"
              optionLabel="name" 
              optionValue="id" 
              placeholder="Select Instructor"
              class="w-[220px]"
              [filter]="true"
              filterBy="name">
            </p-select>
          </div>

          <div class="flex items-center justify-between gap-3 bg-[var(--color-surface)] p-2 border border-[var(--color-border)] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <button 
              pButton 
              type="button" 
              icon="pi pi-chevron-left" 
              class="p-button-text p-button-secondary p-button-sm cursor-pointer"
              (click)="previousWeek()"
              aria-label="Previous week">
            </button>
            
            <span class="text-sm font-bold text-[var(--color-text-primary)] px-2 min-w-[180px] text-center">
              {{ getWeekRangeString() }}
            </span>

            <button 
              pButton 
              type="button" 
              icon="pi pi-chevron-right" 
              class="p-button-text p-button-secondary p-button-sm cursor-pointer"
              (click)="nextWeek()"
              aria-label="Next week">
            </button>
          </div>
        </div>
      </div>

      <!-- Main Schedule content -->
      @if (loading) {
        <div class="flex justify-center items-center py-20">
          <p-progressSpinner styleClass="w-12 h-12" strokeWidth="4" />
        </div>
      } @else {
        <app-weekly-schedule 
          [sessions]="sessions" 
          [currentWeekStart]="currentWeekStart" 
        />
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
  `
})
export class ScheduleComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private http = inject(HttpClient);

  sessions: ScheduleSession[] = [];
  instructors: User[] = [];
  selectedInstructorId: string = '';
  currentWeekStart: Date = new Date();
  loading = false;

  ngOnInit(): void {
    this.calculateWeekStart();
    this.loadInstructors();
  }

  calculateWeekStart(): void {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    this.currentWeekStart = new Date(today.setDate(diff));
    this.currentWeekStart.setHours(0, 0, 0, 0);
  }

  loadInstructors(): void {
    this.lmsService.getUsers().subscribe({
      next: (users) => {
        // Role 2 is Instructor
        this.instructors = users.filter(u => u.role === 2);
        if (this.instructors.length > 0) {
          this.selectedInstructorId = this.instructors[0].id;
          this.loadSchedule();
        }
      },
      error: (err) => {
        this.notify.showError(`Failed to load instructors list: ${err.message || 'Server error'}`);
      }
    });
  }

  loadSchedule(): void {
    if (!this.selectedInstructorId) {
      this.sessions = [];
      return;
    }

    this.loading = true;
    const fromDate = new Date(this.currentWeekStart);
    const toDate = new Date(this.currentWeekStart);
    toDate.setDate(toDate.getDate() + 7);

    // Call schedule API with customized X-User-Id header overriding the interceptor value
    const url = `${this.lmsService.getApiUrl()}/schedule?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`;
    
    this.http.get<ScheduleSession[]>(url, {
      headers: {
        'X-User-Id': this.selectedInstructorId
      }
    }).subscribe({
      next: (res) => {
        this.sessions = res;
        this.loading = false;
      },
      error: (err) => {
        this.notify.showError(`Failed to load schedule: ${err.message || 'Server error'}`);
        this.loading = false;
      }
    });
  }

  onInstructorChange(): void {
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
    end.setDate(end.getDate() + 4);

    const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
  }
}
