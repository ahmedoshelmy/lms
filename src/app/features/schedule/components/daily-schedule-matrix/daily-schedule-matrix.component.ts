import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { User } from '../../../../core/interfaces/User';

export interface TimeSlot {
  label: string; // e.g., "08:00"
  hour: number; // 8
}

@Component({
  selector: 'app-daily-schedule-matrix',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="matrix-container overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
    >
      <div
        class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3"
      >
        <div>
          <h3 class="text-lg font-bold text-[var(--color-text-primary)]">Schedule matrix by day</h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Showing scheduled group sessions per instructor for {{ formattedDayLabel() }}
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 font-medium text-[var(--color-text-muted)] border border-[var(--color-border)]"
          >
            <span class="h-2 w-2 rounded-full bg-[var(--color-primary)]"></span>
            {{ instructors().length }} Instructors
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 font-medium text-[var(--color-text-muted)] border border-[var(--color-border)]"
          >
            <span class="h-2 w-2 rounded-full bg-[var(--color-secondary)]"></span>
            {{ daySessions().length }} Sessions today
          </span>
        </div>
      </div>

      <div class="min-w-[900px]">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr
              class="sticky top-0 z-20 bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] shadow-xs"
            >
              <th
                class="sticky left-0 z-30 w-48 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 font-semibold"
              >
                Instructor
              </th>
              @for (slot of timeSlots; track slot.hour) {
                <th
                  class="border-b border-r border-[var(--color-border)] px-2 py-2.5 text-center font-semibold"
                >
                  {{ slot.label }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (instructor of activeInstructors(); track instructor.id) {
              <tr
                class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <td
                  class="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 font-medium text-[var(--color-text-primary)] shadow-sm"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-neutral-icon-bg)] font-semibold text-[var(--color-primary)] text-[10px]"
                    >
                      {{ getInitials(instructor.name) }}
                    </div>
                    <div class="truncate">
                      <div class="font-semibold text-xs leading-snug">{{ instructor.name }}</div>
                      <div
                        class="text-[10px] text-[var(--color-text-muted)] truncate max-w-[120px]"
                      >
                        {{ instructor.email || 'Instructor' }}
                      </div>
                    </div>
                  </div>
                </td>
                @for (slot of timeSlots; track slot.hour) {
                  <td
                    class="h-16 border-r border-[var(--color-border)] p-1 text-center align-top relative"
                  >
                    @let session = getSessionForSlot(instructor.id, slot.hour);
                    @if (session) {
                      <div
                        (click)="sessionSelected.emit(session)"
                        class="group cursor-pointer rounded-lg border border-[var(--color-secondary)] bg-[var(--color-info-background)] p-1.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md h-full flex flex-col justify-between"
                      >
                        <div>
                          <div
                            class="font-bold text-[11px] text-[var(--color-primary)] leading-tight truncate"
                          >
                            {{ session.groupName || session.courseTitle }}
                          </div>
                          <div class="text-[10px] text-[var(--color-text-muted)] truncate">
                            {{ session.topic || session.courseTitle }}
                          </div>
                        </div>
                        <div
                          class="mt-1 flex items-center justify-between text-[9px] font-medium text-[var(--color-secondary)]"
                        >
                          <span>📍 {{ session.location || 'Online' }}</span>
                          <span
                            class="rounded px-1 bg-[var(--color-neutral-icon-bg)] text-[var(--color-primary)]"
                          >
                            {{ formatTime(session.startsAt) }}
                          </span>
                        </div>
                      </div>
                    } @else {
                      <div
                        class="h-full w-full rounded border border-dashed border-[var(--color-border)] opacity-40 hover:opacity-100 flex items-center justify-center text-[10px] text-[var(--color-text-muted)]"
                      >
                        —
                      </div>
                    }
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td
                  [attr.colspan]="timeSlots.length + 1"
                  class="py-8 text-center text-sm text-[var(--color-text-muted)]"
                >
                  No instructors available for this schedule.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class DailyScheduleMatrixComponent {
  sessions = input<ScheduleSession[]>([]);
  instructors = input<User[]>([]);
  selectedDate = input<Date>(new Date());

  sessionSelected = output<ScheduleSession>();

  readonly timeSlots: TimeSlot[] = [
    { label: '08:00', hour: 8 },
    { label: '09:00', hour: 9 },
    { label: '10:00', hour: 10 },
    { label: '11:00', hour: 11 },
    { label: '12:00', hour: 12 },
    { label: '13:00', hour: 13 },
    { label: '14:00', hour: 14 },
    { label: '15:00', hour: 15 },
    { label: '16:00', hour: 16 },
    { label: '17:00', hour: 17 },
    { label: '18:00', hour: 18 },
    { label: '19:00', hour: 19 },
    { label: '20:00', hour: 20 },
  ];

  readonly formattedDayLabel = computed(() => {
    const d = new Date(this.selectedDate());
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  });

  readonly daySessions = computed(() => {
    const target = new Date(this.selectedDate());
    return this.sessions().filter((s) => {
      const d = new Date(s.startsAt);
      return (
        d.getFullYear() === target.getFullYear() &&
        d.getMonth() === target.getMonth() &&
        d.getDate() === target.getDate()
      );
    });
  });

  readonly activeInstructors = computed(() => {
    const insts = this.instructors().filter((i) => i.id !== 0);
    if (insts.length > 0) return insts;

    // Fallback if instructors list is not passed: extract unique instructors from sessions
    const map = new Map<number, User>();
    for (const s of this.sessions()) {
      if (s.instructorId && !map.has(s.instructorId)) {
        map.set(s.instructorId, {
          id: s.instructorId,
          name: s.instructorName || `Instructor ${s.instructorId}`,
          email: s.instructorEmail || '',
          role: 'Instructor' as any,
        });
      }
    }
    return Array.from(map.values());
  });

  getSessionForSlot(instructorId: number, hour: number): ScheduleSession | undefined {
    return this.daySessions().find((s) => {
      if (s.instructorId !== instructorId) {
        const inst = this.activeInstructors().find((i) => i.id === instructorId);
        if (!inst || !s.instructorName?.toLowerCase().includes(inst.name.toLowerCase())) {
          return false;
        }
      }
      const sHour = new Date(s.startsAt).getHours();
      return sHour === hour;
    });
  }

  getInitials(name: string): string {
    return (name || 'I')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
