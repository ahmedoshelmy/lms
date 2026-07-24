import { Component, input, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';

export type DensityMode = 'compact' | 'comfortable' | 'timeline';

interface CategoryMeta {
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}

interface DayColumn {
  date: Date;
  dayName: string;
  formattedDate: string;
  sessions: ScheduleSession[];
  isToday: boolean;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'mobile', label: 'Mobile App Dev', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
  { key: 'python', label: 'Python', color: '#0d9488', bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.25)' },
  { key: 'wedo', label: 'WeDo / Robotics', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
  { key: 'arduino', label: 'Arduino', color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.25)' },
  { key: 'ai', label: 'AI', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  { key: 'general', label: 'General', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)' },
];

function classifyCategory(session: ScheduleSession): CategoryMeta {
  const text = `${session.topic || ''} ${session.courseTitle || ''}`.toLowerCase();
  if (/mobile|app dev|android|ios|flutter|react native/.test(text)) return CATEGORIES[0];
  if (/python|py\b/.test(text)) return CATEGORIES[1];
  if (/wedo|robotics|lego/.test(text)) return CATEGORIES[2];
  if (/arduino|electronics|sensor/.test(text)) return CATEGORIES[3];
  if (/\bai\b|machine learning|deep learning|neural/.test(text)) return CATEGORIES[4];
  return CATEGORIES[5];
}

function parseTime(iso: string): number {
  return new Date(iso).getTime();
}

function overlaps(a: ScheduleSession, b: ScheduleSession): boolean {
  return parseTime(a.startsAt) < parseTime(b.endsAt) && parseTime(b.startsAt) < parseTime(a.endsAt);
}

@Component({
  selector: 'app-weekly-schedule',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekly-schedule.component.html',
  styleUrl: './weekly-schedule.component.scss',
})
export class WeeklyScheduleComponent {
  sessions = input<ScheduleSession[]>([]);
  currentWeekStart = input<Date>(new Date());
  locationFilter = input<string>('');
  densityMode = input<DensityMode>('compact');

  sessionSelected = output<ScheduleSession>();

  readonly categories = CATEGORIES;

  readonly categoryMap = computed(() => {
    const map = new Map<number, CategoryMeta>();
    for (const s of this.sessions()) {
      map.set(s.id, classifyCategory(s));
    }
    return map;
  });

  readonly uniqueLocations = computed(() => {
    const set = new Set<string>();
    for (const s of this.sessions()) {
      if (s.location) set.add(s.location);
    }
    return Array.from(set).sort();
  });

  readonly conflictIds = computed(() => {
    const ids = new Set<number>();
    const all = this.sessions();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (!overlaps(all[i], all[j])) continue;
        if (all[i].instructorId && all[i].instructorId === all[j].instructorId) {
          ids.add(all[i].id);
          ids.add(all[j].id);
        }
        if (all[i].location && all[i].location === all[j].location) {
          ids.add(all[i].id);
          ids.add(all[j].id);
        }
      }
    }
    return ids;
  });

  readonly filteredSessions = computed(() => {
    const loc = this.locationFilter();
    if (!loc) return this.sessions();
    return this.sessions().filter((s) => s.location === loc);
  });

  readonly dayColumns = computed<DayColumn[]>(() => {
    const startOfWeek = new Date(this.currentWeekStart());
    startOfWeek.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const days: DayColumn[] = [];
    const weekdays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const sess = this.filteredSessions();

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const daySessions = sess
        .filter((s) => {
          const d = new Date(s.startsAt);
          return d.getFullYear() === currentDate.getFullYear() &&
            d.getMonth() === currentDate.getMonth() &&
            d.getDate() === currentDate.getDate();
        })
        .sort((a, b) => parseTime(a.startsAt) - parseTime(b.startsAt));

      days.push({
        date: currentDate,
        dayName: weekdays[i],
        formattedDate: currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        sessions: daySessions,
        isToday: currentDate.getTime() === todayMs,
      });
    }
    return days;
  });

  readonly totalSessions = computed(() =>
    this.dayColumns().reduce((sum, col) => sum + col.sessions.length, 0)
  );

  readonly distinctInstructors = computed(() => {
    const set = new Set<number>();
    for (const s of this.filteredSessions()) {
      if (s.instructorId) set.add(s.instructorId);
    }
    return set.size;
  });

  readonly distinctLocations = computed(() => {
    const set = new Set<string>();
    for (const s of this.filteredSessions()) {
      if (s.location) set.add(s.location);
    }
    return set.size;
  });

  readonly conflictSessionsCount = computed(() => this.conflictIds().size);

  getCategory(session: ScheduleSession): CategoryMeta {
    return this.categoryMap().get(session.id) || CATEGORIES[5];
  }

  isConflict(session: ScheduleSession): boolean {
    return this.conflictIds().has(session.id);
  }

  getInitials(name: string): string {
    return (name || 'U').split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  }

  getProgressPercent(s: ScheduleSession): number {
    if (!s.totalSessions) return 0;
    return Math.round((s.currentSessionNumber / s.totalSessions) * 100);
  }

  getProgressLabel(s: ScheduleSession): string {
    const pct = this.getProgressPercent(s);
    if (pct >= 100) return 'Complete';
    if (pct >= 80) return 'Nearly done';
    if (pct >= 50) return 'In progress';
    return 'Early stage';
  }

  onSessionClick(session: ScheduleSession): void {
    this.sessionSelected.emit(session);
  }

  getStatusBadgeClass(status: string): string {
    const n = (status ?? '').toLowerCase();
    if (n.includes('running')) return 'badge-ongoing';
    if (n.includes('completed')) return 'badge-completed';
    if (n.includes('cancel')) return 'badge-cancelled';
    return 'badge-scheduled';
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getTimelineHours(): number[] {
    return Array.from({ length: 14 }, (_, i) => i + 7);
  }

  getTimelineSessionsForHour(col: DayColumn, hour: number): ScheduleSession[] {
    return col.sessions.filter((s) => {
      const h = new Date(s.startsAt).getHours();
      return h === hour;
    });
  }
}
