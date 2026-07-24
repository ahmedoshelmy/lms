import { Component, input, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';

interface DayColumn {
  date: Date;
  dayName: string;
  formattedDate: string;
  sessions: ScheduleSession[];
  isToday: boolean;
}

@Component({
  selector: 'app-weekly-schedule',
  standalone: true,
  imports: [CommonModule, CardModule, TooltipModule],
  template: `
    <div class="weekly-schedule-wrapper">
      <!-- Desktop View: Grid -->
      <div
        class="hidden md:grid grid-cols-7 gap-4 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
      >
        @for (col of dayColumns(); track col.dayName) {
          <div
            class="day-column flex flex-col border-r last:border-r-0 border-[var(--color-border)] pr-2 last:pr-0"
          >
            <!-- Day Header -->
            <div class="day-header border-b border-[var(--color-border)] pb-3 mb-4 text-center">
              <h3 class="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {{ col.dayName }}
              </h3>
              <p class="text-lg font-extrabold text-[var(--color-text-primary)] mt-0.5">
                {{ col.formattedDate }}
              </p>
            </div>

            <!-- Day Sessions -->
            <div class="sessions-container flex-grow flex flex-col gap-3 min-h-[300px]">
              @for (session of col.sessions; track session.id) {
                <div
                  class="session-card p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-secondary)] hover:shadow-[0_4px_12px_rgba(62,109,181,0.08)] transition-all duration-300 flex flex-col justify-between cursor-pointer"
                  [ngClass]="getStatusCardClass(session.status)"
                >
                  <div>
                    <!-- Header Info -->
                    <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div class="flex gap-1 flex-wrap">
                        <span
                          class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          [ngClass]="getStatusBadgeClass(session.status)"
                        >
                          {{ session.status }}
                        </span>
                        <span
                          class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          [ngClass]="getTypeBadgeClass(session.type)"
                        >
                          {{ session.type }}
                        </span>
                      </div>
                      <span class="text-[10px] text-[var(--color-text-muted)] font-bold">
                        Session {{ session.currentSessionNumber }} of {{ session.totalSessions }}
                      </span>
                    </div>

                    <!-- Topic -->
                    <h4
                      class="text-sm font-bold text-[var(--color-text-primary)] line-clamp-2"
                      [title]="session.topic"
                    >
                      {{ session.topic }}
                    </h4>
                    <!-- Course & Cohort -->
                    <p
                      class="text-xs text-[var(--color-text-secondary)] font-medium mt-1 truncate"
                      [title]="session.courseTitle"
                    >
                      {{ session.courseTitle }}
                    </p>
                    <p class="text-[10px] text-[var(--color-text-muted)] font-semibold mt-0.5">
                      {{ session.groupName }}
                    </p>
                  </div>

                  <!-- Footer details -->
                  <div
                    class="border-t border-[var(--color-border)] pt-2.5 mt-3 flex flex-col gap-1 text-[11px] text-[var(--color-text-muted)]"
                  >
                    <div class="flex items-center gap-1.5">
                      <i class="pi pi-clock text-[var(--color-text-muted)]"></i>
                      <span class="font-medium">
                        {{ formatTime(session.startsAt) }} - {{ formatTime(session.endsAt) }} ({{
                          session.durationMinutes
                        }}m)
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <i class="pi pi-user text-[var(--color-text-muted)]"></i>
                      <span class="truncate font-semibold text-[var(--color-secondary)]">{{
                        session.instructorName
                      }}</span>
                    </div>
                    @if (session.location) {
                      <div class="flex items-center gap-1.5">
                        <i class="pi pi-map-marker text-[var(--color-text-muted)]"></i>
                        <span class="truncate">{{ session.location }}</span>
                      </div>
                    }
                  </div>
                </div>
              } @empty {
                <div
                  class="flex flex-col items-center justify-center flex-grow py-8 text-center text-[var(--color-text-muted)]"
                >
                  <i class="pi pi-calendar text-2xl mb-1.5 opacity-60"></i>
                  <span class="text-xs font-medium">Free day</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Mobile View: Vertical Accordion-List -->
      <div class="flex flex-col md:hidden gap-6">
        @for (col of dayColumns(); track col.dayName) {
          <div
            class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
          >
            <div
              class="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4"
            >
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-[var(--color-secondary)]"></span>
                <h3 class="text-base font-bold text-[var(--color-text-primary)]">
                  {{ col.dayName }}
                </h3>
              </div>
              <span class="text-sm font-bold text-[var(--color-text-muted)]">{{
                col.formattedDate
              }}</span>
            </div>

            <div class="flex flex-col gap-4">
              @for (session of col.sessions; track session.id) {
                <div
                  class="mobile-session-card p-4 rounded-xl border border-[var(--color-border)] flex flex-col gap-3"
                  [ngClass]="getStatusCardClass(session.status)"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="flex gap-1 flex-wrap mb-1.5">
                        <span
                          class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          [ngClass]="getStatusBadgeClass(session.status)"
                        >
                          {{ session.status }}
                        </span>
                        <span
                          class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          [ngClass]="getTypeBadgeClass(session.type)"
                        >
                          {{ session.type }}
                        </span>
                      </div>
                      <h4 class="text-sm font-bold text-[var(--color-text-primary)]">
                        {{ session.topic }}
                      </h4>
                      <p class="text-xs text-[var(--color-text-secondary)] font-medium mt-0.5">
                        {{ session.courseTitle }}
                      </p>
                      <p class="text-[10px] text-[var(--color-text-muted)] font-semibold">
                        {{ session.groupName }}
                      </p>
                    </div>
                    <span
                      class="text-xs text-[var(--color-text-muted)] font-bold whitespace-nowrap"
                    >
                      Session {{ session.currentSessionNumber }} of {{ session.totalSessions }}
                    </span>
                  </div>

                  <div
                    class="grid grid-cols-2 gap-2 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3"
                  >
                    <div class="flex items-center gap-1.5">
                      <i class="pi pi-clock text-[var(--color-text-muted)]"></i>
                      <span
                        >{{ formatTime(session.startsAt) }} - {{ formatTime(session.endsAt) }}</span
                      >
                    </div>
                    <div class="flex items-center gap-1.5">
                      <i class="pi pi-user text-[var(--color-text-muted)]"></i>
                      <span class="truncate font-semibold text-[var(--color-secondary)]">{{
                        session.instructorName
                      }}</span>
                    </div>
                    @if (session.location) {
                      <div class="flex items-center gap-1.5 col-span-2">
                        <i class="pi pi-map-marker text-[var(--color-text-muted)]"></i>
                        <span class="truncate">{{ session.location }}</span>
                      </div>
                    }
                  </div>
                </div>
              } @empty {
                <div class="text-center py-4 text-[var(--color-text-muted)] text-xs font-semibold">
                  No sessions scheduled for this day.
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .session-card {
      background-color: var(--color-surface);
      min-height: 160px;
    }

    .status-scheduled-card {
      border-left: 4px solid var(--color-primary);
    }
    .status-ongoing-card {
      border-left: 4px solid var(--color-warning);
    }
    .status-completed-card {
      border-left: 4px solid var(--color-success);
    }
    .status-cancelled-card {
      border-left: 4px solid var(--color-error);
      opacity: 0.65;
    }

    .status-scheduled-badge {
      background-color: rgba(26, 43, 76, 0.08);
      color: var(--color-primary);
    }
    .status-ongoing-badge {
      background-color: rgba(245, 158, 11, 0.08);
      color: var(--color-warning);
    }
    .status-completed-badge {
      background-color: rgba(16, 185, 129, 0.08);
      color: var(--color-success);
    }
    .status-cancelled-badge {
      background-color: rgba(239, 68, 68, 0.08);
      color: var(--color-error, #ef4444);
    }

    .type-group-badge {
      background-color: var(--color-session-group-background);
      color: var(--color-session-group-foreground);
    }
    .type-makeup-badge {
      background-color: var(--color-session-makeup-background);
      color: var(--color-session-makeup-foreground);
    }
    .type-trial-badge {
      background-color: var(--color-session-trial-background);
      color: var(--color-session-trial-foreground);
    }
  `,
})
export class WeeklyScheduleComponent {
  sessions = input<ScheduleSession[]>([]);
  currentWeekStart = input<Date>(new Date());

  /** Emits the session the user clicked on */
  sessionSelected = output<ScheduleSession>();

  private todayMidnight(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Create columns for 7 days starting from Saturday
  dayColumns = computed<DayColumn[]>(() => {
    const startOfWeek = new Date(this.currentWeekStart());
    startOfWeek.setHours(0, 0, 0, 0);

    const today = this.todayMidnight().getTime();
    const days: DayColumn[] = [];
    const weekdays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      // Filter sessions for this specific day, then sort ascending by start time
      const daySessions = (this.sessions() || [])
        .filter((session) => {
          const sessionDate = new Date(session.startsAt);
          return (
            sessionDate.getFullYear() === currentDate.getFullYear() &&
            sessionDate.getMonth() === currentDate.getMonth() &&
            sessionDate.getDate() === currentDate.getDate()
          );
        })
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

      days.push({
        date: currentDate,
        dayName: weekdays[i],
        formattedDate: currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        sessions: daySessions,
        isToday: currentDate.getTime() === today,
      });
    }

    return days;
  });

  totalSessions = computed(() =>
    this.dayColumns().reduce((sum, col) => sum + col.sessions.length, 0)
  );

  onSessionClick(session: ScheduleSession): void {
    this.sessionSelected.emit(session);
  }

  getStatusCardClass(status: string): string {
    const normStatus = (status ?? '').toLowerCase();
    if (normStatus.includes('ongoing')) return 'status-ongoing-card';
    if (normStatus.includes('completed')) return 'status-completed-card';
    if (normStatus.includes('cancel')) return 'status-cancelled-card';
    return 'status-scheduled-card';
  }

  getStatusBadgeClass(status: string): string {
    const normStatus = (status ?? '').toLowerCase();
    if (normStatus.includes('ongoing')) return 'status-ongoing-badge';
    if (normStatus.includes('completed')) return 'status-completed-badge';
    if (normStatus.includes('cancel')) return 'status-cancelled-badge';
    return 'status-scheduled-badge';
  }

  getTypeBadgeClass(type: string): string {
    const normType = (type ?? '').toLowerCase();
    if (normType.includes('makeup')) return 'type-makeup-badge';
    if (normType.includes('trial')) return 'type-trial-badge';
    return 'type-group-badge';
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}
