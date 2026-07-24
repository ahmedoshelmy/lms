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
  templateUrl: './weekly-schedule.component.html',
  styleUrl: './weekly-schedule.component.scss',
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
