import { Component, input, computed, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';

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
  currentDate = input<Date>(new Date());
  viewMode = input<ViewMode>('weekly');
  searchQuery = input<string>('');
  courseFilter = input<string>('');
  topicFilter = input<string>('');
  levelFilter = input<string>('');
  instructorFilter = input<string>('');
  locationFilter = input<string>('');
  densityMode = input<DensityMode>('compact');

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
        if (!overlaps(a, b)) continue;

        // Check same instructor overlap
        const sameInstructor =
          (a.instructorId && b.instructorId && a.instructorId === b.instructorId) ||
          (a.instructorName &&
            b.instructorName &&
            a.instructorName.trim().toLowerCase() !== 'unassigned' &&
            a.instructorName.trim().toLowerCase() === b.instructorName.trim().toLowerCase());

        // Check same physical location overlap (excluding Online and empty locations)
        const locA = (a.location || '').trim().toLowerCase();
        const locB = (b.location || '').trim().toLowerCase();
        const sameLocation =
          locA !== '' &&
          locA !== 'online' &&
          locA !== 'n/a' &&
          locB !== '' &&
          locB !== 'online' &&
          locB !== 'n/a' &&
          locA === locB;

        if (sameInstructor || sameLocation) {
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
    const cat = this.activeCategory();

    return this.sessions().filter((s) => {
      // 1. Search Query filter
      if (q) {
        const text = `${s.topic} ${s.courseTitle} ${s.groupName} ${s.instructorName} ${s.location || ''}`.toLowerCase();
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
          s.instructorName.toLowerCase().includes(inst) ||
          s.instructorId.toString() === inst;
        if (!instMatch) return false;
      }
      // 6. Location filter
      if (loc && (s.location || '').toLowerCase() !== loc) return false;
      // 7. Category Pill filter
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
        formattedDate: curDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        sessions: daySessions,
        isToday: curDate.getTime() === todayMs,
      });
    } else {
      const startOfWeek = new Date(this.currentWeekStart());
      startOfWeek.setHours(0, 0, 0, 0);
      const weekdays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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
          formattedDate: currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
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
    if (n.includes('running')) return 'badge-ongoing';
    if (n.includes('completed')) return 'badge-completed';
    if (n.includes('cancel')) return 'badge-cancelled';
    return 'badge-scheduled';
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

