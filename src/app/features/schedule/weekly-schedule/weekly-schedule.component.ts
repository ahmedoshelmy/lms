import { Component, input, computed, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import {
  getSessionCode,
  getSessionBaseCode,
  getSessionDisplayTopic,
  getSessionSequence,
  getSessionSequenceLabel,
} from '../../../core/utils/session-code.utils';

export type DensityMode = 'compact' | 'comfortable' | 'timeline';
export type ViewMode = 'weekly' | 'daily';

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
  {
    key: 'mobile',
    label: 'Mobile App Dev',
    color: 'var(--color-session-group)',
    bg: 'var(--color-session-group-background)',
    border: 'color-mix(in srgb, var(--color-session-group) 25%, transparent)',
  },
  {
    key: 'python',
    label: 'Python',
    color: 'var(--color-session-makeup)',
    bg: 'var(--color-session-makeup-background)',
    border: 'color-mix(in srgb, var(--color-session-makeup) 25%, transparent)',
  },
  {
    key: 'wedo',
    label: 'WeDo / Robotics',
    color: 'var(--color-session-trial)',
    bg: 'var(--color-session-trial-background)',
    border: 'color-mix(in srgb, var(--color-session-trial) 25%, transparent)',
  },
  {
    key: 'arduino',
    label: 'Arduino',
    color: 'var(--color-warning)',
    bg: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
    border: 'color-mix(in srgb, var(--color-warning) 25%, transparent)',
  },
  {
    key: 'ai',
    label: 'AI',
    color: 'var(--color-info)',
    bg: 'var(--color-info-background)',
    border: 'color-mix(in srgb, var(--color-info) 25%, transparent)',
  },
  {
    key: 'general',
    label: 'General',
    color: 'var(--color-text-muted)',
    bg: 'color-mix(in srgb, var(--color-text-muted) 8%, transparent)',
    border: 'color-mix(in srgb, var(--color-text-muted) 25%, transparent)',
  },
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
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

function getStartMs(s: ScheduleSession): number {
  if (!s || !s.startsAt) return 0;
  return parseTime(s.startsAt);
}

function getEndMs(s: ScheduleSession): number {
  if (!s) return 0;
  if (s.endsAt) {
    const t = new Date(s.endsAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const start = getStartMs(s);
  const durationMs = (s.durationMinutes || 60) * 60 * 1000;
  return start + durationMs;
}

function overlaps(a: ScheduleSession, b: ScheduleSession): boolean {
  const startA = getStartMs(a);
  const endA = getEndMs(a);
  const startB = getStartMs(b);
  const endB = getEndMs(b);

  if (!startA || !endA || !startB || !endB) return false;

  // Strict time overlap: Session A starts before Session B ends AND Session B starts before Session A ends
  return startA < endB && startB < endA;
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
  currentDate = input<Date>(new Date());
  viewMode = input<ViewMode>('weekly');
  searchQuery = input<string>('');
  courseFilter = input<string>('');
  topicFilter = input<string>('');
  levelFilter = input<string>('');
  instructorFilter = input<string>('');
  locationFilter = input<string>('');
  statusFilter = input<string>('');
  densityMode = input<DensityMode>('compact');
  isAdmin = input<boolean>(false);

  sessionSelected = output<ScheduleSession>();

  readonly categories = CATEGORIES;
  activeCategory = signal<string>('all');

  readonly categoryMap = computed(() => {
    const map = new Map<number, CategoryMeta>();
    for (const s of this.sessions()) {
      map.set(s.id, classifyCategory(s));
    }
    return map;
  });

  readonly conflictIds = computed(() => {
    const ids = new Set<number>();
    const all = this.sessions();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];

        // 1. Ignore cancelled sessions
        const statusA = (a.status ?? '').toLowerCase();
        const statusB = (b.status ?? '').toLowerCase();
        if (statusA.includes('cancel') || statusB.includes('cancel')) continue;

        // 2. Conflicts ONLY apply when the SAME instructor is double-booked
        const nameA = (a.instructorName || '').trim().toLowerCase();
        const nameB = (b.instructorName || '').trim().toLowerCase();
        if (!nameA || nameA === 'unassigned' || !nameB || nameB === 'unassigned') continue;

        const sameInstructor =
          (a.instructorId && b.instructorId && a.instructorId === b.instructorId) ||
          nameA === nameB;

        if (!sameInstructor) continue;

        // 3. Check strict time overlap
        if (overlaps(a, b)) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  });

  readonly filteredSessions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const course = this.courseFilter().trim().toLowerCase();
    const topic = this.topicFilter().trim().toLowerCase();
    const level = this.levelFilter().trim().toLowerCase();
    const inst = this.instructorFilter().trim().toLowerCase();
    const loc = this.locationFilter().trim().toLowerCase();
    const status = this.statusFilter().trim().toLowerCase();
    const cat = this.activeCategory();

    return this.sessions().filter((s) => {
      // 1. Search Query filter
      if (q) {
        const text =
          `${s.topic} ${s.courseTitle} ${s.groupName} ${s.instructorName} ${s.location || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      // 2. Course filter
      if (course && !s.courseTitle.toLowerCase().includes(course)) return false;
      // 3. Topic filter
      if (topic && !s.topic.toLowerCase().includes(topic)) return false;
      // 4. Level filter
      if (level) {
        const sLevel = `${s.groupName} ${s.courseTitle}`.toLowerCase();
        if (!sLevel.includes(level)) return false;
      }
      // 5. Instructor filter
      if (inst) {
        const instMatch =
          s.instructorName.toLowerCase().includes(inst) || s.instructorId.toString() === inst;
        if (!instMatch) return false;
      }
      // 6. Location filter
      if (loc && (s.location || '').toLowerCase() !== loc) return false;
      // 7. Status filter
      if (status && !(s.status || '').toLowerCase().includes(status)) return false;
      // 8. Category Pill filter
      if (cat !== 'all') {
        const sessionCat = this.getCategory(s).key;
        if (sessionCat !== cat) return false;
      }

      return true;
    });
  });

  readonly dayColumns = computed<DayColumn[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const sess = this.filteredSessions();
    const days: DayColumn[] = [];

    if (this.viewMode() === 'daily') {
      const curDate = new Date(this.currentDate());
      curDate.setHours(0, 0, 0, 0);
      const dayName = curDate.toLocaleDateString('en-US', { weekday: 'long' });
      const daySessions = sess
        .filter((s) => {
          const d = new Date(s.startsAt);
          return (
            d.getFullYear() === curDate.getFullYear() &&
            d.getMonth() === curDate.getMonth() &&
            d.getDate() === curDate.getDate()
          );
        })
        .sort((a, b) => parseTime(a.startsAt) - parseTime(b.startsAt));

      days.push({
        date: curDate,
        dayName,
        formattedDate: curDate.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        sessions: daySessions,
        isToday: curDate.getTime() === todayMs,
      });
    } else {
      const startOfWeek = new Date(this.currentWeekStart());
      startOfWeek.setHours(0, 0, 0, 0);
      const weekdays = [
        'Saturday',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ];

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);
        const daySessions = sess
          .filter((s) => {
            const d = new Date(s.startsAt);
            return (
              d.getFullYear() === currentDate.getFullYear() &&
              d.getMonth() === currentDate.getMonth() &&
              d.getDate() === currentDate.getDate()
            );
          })
          .sort((a, b) => parseTime(a.startsAt) - parseTime(b.startsAt));

        days.push({
          date: currentDate,
          dayName: weekdays[i],
          formattedDate: currentDate.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
          }),
          sessions: daySessions,
          isToday: currentDate.getTime() === todayMs,
        });
      }
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
    return (name || 'U')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  toggleCategory(key: string): void {
    if (this.activeCategory() === key) {
      this.activeCategory.set('all');
    } else {
      this.activeCategory.set(key);
    }
  }

  onSessionClick(session: ScheduleSession): void {
    this.sessionSelected.emit(session);
  }

  getStatusBadgeClass(status: string): string {
    const n = (status ?? '').toLowerCase();
    if (n.includes('completed')) return 'badge-completed';
    if (n.includes('cancel')) return 'badge-cancelled';
    return 'badge-scheduled';
  }

  getAttendanceBadge(s: ScheduleSession): { label: string; css: string; icon: string } {
    const status = (s.status || '').toLowerCase();
    if (status.includes('cancel')) {
      return {
        label: 'Cancelled',
        css: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        icon: 'pi-times-circle',
      };
    }
    if (status.includes('completed')) {
      return {
        label: 'Attendance Marked',
        css: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        icon: 'pi-check-circle',
      };
    }

    const now = new Date();
    const sessionTime = new Date(s.startsAt || Date.now());
    if (sessionTime <= now) {
      return {
        label: 'Attendance Pending',
        css: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: 'pi-exclamation-triangle',
      };
    }

    return {
      label: 'Upcoming',
      css: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      icon: 'pi-clock',
    };
  }

  getLeftAccentColor(s: ScheduleSession): string {
    const status = (s.status || '').toLowerCase();
    if (status.includes('cancel')) return 'var(--color-error)';
    if (status.includes('completed')) return 'var(--color-secondary)';
    const att = this.getAttendanceBadge(s);
    if (att.label === 'Attendance Pending') return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  getSessionSequence(s: ScheduleSession): string {
    return getSessionSequence(s);
  }

  getSessionSequenceLabel(s: ScheduleSession): string {
    return getSessionSequenceLabel(s);
  }

  getSessionCode(s: any): string {
    return getSessionCode(s);
  }

  getSessionBaseCode(s: any): string {
    return getSessionBaseCode(s);
  }

  getSessionDisplayTopic(s: any): string {
    return getSessionDisplayTopic(s);
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
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
