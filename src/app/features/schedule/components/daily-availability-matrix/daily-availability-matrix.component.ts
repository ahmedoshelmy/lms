import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { User } from '../../../../core/interfaces/User';

export interface TimeSlot {
  label: string;
  hour: number;
}

export type AvailabilityState = 'available' | 'booked' | 'off';

export interface SlotAvailability {
  state: AvailabilityState;
  session?: ScheduleSession;
}

@Component({
  selector: 'app-daily-availability-matrix',
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
          <h3 class="text-lg font-bold text-[var(--color-text-primary)]">
            Instructor availability matrix by day
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Real-time availability status for instructors on {{ formattedDayLabel() }}
          </p>
        </div>

        <!-- Legend badges -->
        <div class="flex items-center gap-3 text-xs">
          <div class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded bg-[var(--color-success)]"></span>
            <span class="font-medium text-[var(--color-text-secondary)]">Available</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded bg-[var(--color-warning)]"></span>
            <span class="font-medium text-[var(--color-text-secondary)]">Booked</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded bg-[var(--color-border)]"></span>
            <span class="font-medium text-[var(--color-text-muted)]">Off-Duty</span>
          </div>
        </div>
      </div>

      <div class="min-w-[900px]">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]">
              <th
                class="sticky left-0 z-10 w-48 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 font-semibold"
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
                        {{ getAvailabilitySummary(instructor.id) }}
                      </div>
                    </div>
                  </div>
                </td>
                @for (slot of timeSlots; track slot.hour) {
                  @let avail = getSlotAvailability(instructor.id, slot.hour);
                  <td
                    class="h-14 border-r border-[var(--color-border)] p-1 text-center align-middle"
                  >
                    @if (avail.state === 'booked') {
                      <div
                        class="h-full rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-background)] p-1 flex flex-col justify-center text-left"
                      >
                        <span
                          class="font-bold text-[10px] text-[var(--color-warning-foreground)] truncate"
                        >
                          {{ avail.session?.groupName || 'Booked' }}
                        </span>
                        <span class="text-[9px] text-[var(--color-text-muted)] truncate">
                          {{ avail.session?.topic || 'Session' }}
                        </span>
                      </div>
                    } @else if (avail.state === 'available') {
                      <div
                        class="h-full rounded-md border border-[var(--color-success)] bg-[var(--color-success-background)] flex items-center justify-center font-semibold text-[10px] text-[var(--color-success-foreground)]"
                      >
                        Available
                      </div>
                    } @else {
                      <div
                        class="h-full rounded-md bg-[var(--color-surface-secondary)] opacity-50 flex items-center justify-center text-[10px] text-[var(--color-text-muted)]"
                      >
                        Off
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
                  No instructor records found.
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
export class DailyAvailabilityMatrixComponent {
  sessions = input<ScheduleSession[]>([]);
  instructors = input<User[]>([]);
  selectedDate = input<Date>(new Date());

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

  getSlotAvailability(instructorId: number, hour: number): SlotAvailability {
    // Working hours window: 09:00 to 18:00 is standard working hours
    if (hour < 9 || hour >= 18) {
      return { state: 'off' };
    }

    const session = this.daySessions().find((s) => {
      if (s.instructorId !== instructorId) {
        const inst = this.activeInstructors().find((i) => i.id === instructorId);
        if (!inst || !s.instructorName?.toLowerCase().includes(inst.name.toLowerCase())) {
          return false;
        }
      }
      const sHour = new Date(s.startsAt).getHours();
      return sHour === hour;
    });

    if (session) {
      return { state: 'booked', session };
    }

    return { state: 'available' };
  }

  getAvailabilitySummary(instructorId: number): string {
    let freeCount = 0;
    let bookedCount = 0;
    for (const slot of this.timeSlots) {
      const avail = this.getSlotAvailability(instructorId, slot.hour);
      if (avail.state === 'available') freeCount++;
      if (avail.state === 'booked') bookedCount++;
    }
    return `${freeCount} Free · ${bookedCount} Booked`;
  }

  getInitials(name: string): string {
    return (name || 'I')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
