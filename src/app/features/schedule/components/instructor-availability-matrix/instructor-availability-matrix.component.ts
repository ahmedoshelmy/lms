import { Component, input, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { User } from '../../../../core/interfaces/User';
import {
  InstructorAvailability,
  InstructorTimeOff,
} from '../../../../core/interfaces/Availability';
import { isDeclaredAvailable, isOnLeave } from '../../../../core/utils/availability.utils';

export interface DayColumnMeta {
  dayName: string;
  date: Date;
  formattedDate: string;
}

export interface TimeSlot {
  label: string;
  hour: number;
}

@Component({
  selector: 'app-instructor-availability-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  template: `
    <div
      class="matrix-container rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
    >
      <div
        class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3"
      >
        <div>
          <h3 class="text-lg font-bold text-[var(--color-text-primary)]">
            Instructor weekly schedule & availability
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            @if (canPickInstructor()) {
              Declared hours, leave and what is booked, for one instructor
            } @else {
              Your declared hours and what is booked this week
            }
          </p>
        </div>

        <!-- Instructor Filter Dropdown — Admin only -->
        @if (canPickInstructor()) {
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-[var(--color-text-secondary)]">
              Select Instructor:
            </label>
            <p-select
              [options]="instructorOptions()"
              [ngModel]="selectedInstructorId()"
              (ngModelChange)="onInstructorChange($event)"
              optionLabel="name"
              optionValue="id"
              placeholder="Select Instructor"
              styleClass="p-inputtext-sm w-56"
            />
          </div>
        }
      </div>

      <!-- Instructor Summary Header Card -->
      @if (selectedInstructor(); as inst) {
        <div
          class="mb-4 flex flex-wrap items-center justify-between rounded-lg bg-[var(--color-surface-secondary)] p-3 border border-[var(--color-border)]"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] font-bold text-white text-sm"
            >
              {{ getInitials(inst.name) }}
            </div>
            <div>
              <div class="font-bold text-sm text-[var(--color-text-primary)]">{{ inst.name }}</div>
              <div class="text-xs text-[var(--color-text-muted)]">
                {{ inst.email || 'Instructor Account' }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4 text-xs">
            <div
              class="text-center px-3 py-1 bg-[var(--color-surface)] rounded border border-[var(--color-border)]"
            >
              <span class="block font-bold text-[var(--color-primary)] text-sm">{{
                weeklyBookedCount()
              }}</span>
              <span class="text-[10px] text-[var(--color-text-muted)]">Scheduled Sessions</span>
            </div>
            <div
              class="text-center px-3 py-1 bg-[var(--color-surface)] rounded border border-[var(--color-border)]"
            >
              <span class="block font-bold text-[var(--color-success)] text-sm">{{
                weeklyFreeCount()
              }}</span>
              <span class="text-[10px] text-[var(--color-text-muted)]">Available Slots</span>
            </div>

            <!-- Hours against the limit, which is what says whether this
                 instructor can take another group. -->
            <div
              class="px-3 py-1 bg-[var(--color-surface)] rounded border"
              [class.border-[var(--color-border)]]="!isOverCapacity()"
              [class.border-[var(--color-warning-foreground)]]="isOverCapacity()"
            >
              <div class="flex items-baseline gap-1 justify-center">
                <span
                  class="font-bold text-sm"
                  [class.text-[var(--color-warning-foreground)]]="isOverCapacity()"
                  >{{ weeklyHours() }}</span
                >
                @if (capacityHours()) {
                  <span class="text-[10px] text-[var(--color-text-muted)]"
                    >/ {{ capacityHours() }}h</span
                  >
                }
              </div>
              <span class="text-[10px] text-[var(--color-text-muted)]">
                @if (capacityHours()) {
                  Hours this week
                } @else {
                  Hours this week &middot; no limit set
                }
              </span>
              @if (capacityHours()) {
                <div class="mt-1 h-1 w-full rounded-full bg-[var(--color-surface-secondary)]">
                  <div
                    class="h-full rounded-full"
                    [class.bg-[var(--color-primary)]]="!isOverCapacity()"
                    [class.bg-[var(--color-warning-foreground)]]="isOverCapacity()"
                    [style.width.%]="capacityUsedPercent()"
                  ></div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- min-width belongs on the table, not the scroll container: on the
           container it widens the panel instead of scrolling inside it. -->
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead>
            <tr class="bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]">
              <th
                class="sticky left-0 z-10 w-24 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2.5 font-semibold text-center"
              >
                Time
              </th>
              @for (day of weekDays(); track day.dayName) {
                <th
                  class="border-b border-r border-[var(--color-border)] px-2 py-2.5 text-center font-semibold"
                >
                  <div>{{ day.dayName }}</div>
                  <div class="text-[10px] font-normal text-[var(--color-text-muted)]">
                    {{ day.formattedDate }}
                  </div>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (slot of timeSlots; track slot.hour) {
              <tr
                class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <td
                  class="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 font-semibold text-[var(--color-text-secondary)] text-center shadow-sm"
                >
                  {{ slot.label }}
                </td>
                @for (day of weekDays(); track day.dayName) {
                  @let cell = getInstructorSlotState(day.date, slot.hour);
                  <td
                    class="h-14 border-r border-[var(--color-border)] p-1 text-center align-middle"
                  >
                    @if (cell.session) {
                      <div
                        (click)="sessionSelected.emit(cell.session)"
                        class="h-full rounded-md border border-[var(--color-secondary)] bg-[var(--color-info-background)] p-1.5 text-left cursor-pointer hover:shadow-xs transition-all flex flex-col justify-between"
                      >
                        <div class="font-bold text-[10px] text-[var(--color-primary)] truncate">
                          {{ cell.session.groupName || cell.session.courseTitle }}
                        </div>
                        <div class="text-[9px] text-[var(--color-text-muted)] truncate">
                          📍 {{ cell.session.location || 'Room' }}
                        </div>
                      </div>
                    } @else if (cell.onLeave) {
                      <div
                        class="h-full rounded-md border border-[var(--color-warning-foreground)] bg-[var(--color-warning-background)] flex items-center justify-center font-semibold text-[10px] text-[var(--color-warning-foreground)]"
                      >
                        On leave
                      </div>
                    } @else if (cell.isWorkingHour) {
                      <div
                        class="h-full rounded-md border border-[var(--color-success)] bg-[var(--color-success-background)] flex items-center justify-center font-semibold text-[10px] text-[var(--color-success-foreground)]"
                      >
                        Available
                      </div>
                    } @else {
                      <div
                        class="h-full rounded-md bg-[var(--color-surface-secondary)] opacity-40 flex items-center justify-center text-[10px] text-[var(--color-text-muted)]"
                      >
                        Not working
                      </div>
                    }
                  </td>
                }
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
export class InstructorAvailabilityMatrixComponent {
  sessions = input<ScheduleSession[]>([]);
  instructors = input<User[]>([]);
  currentWeekStart = input<Date>(new Date());
  /**
   * Whether this user chooses which instructor to look at. True for admin and
   * for sales, who need the whole board to find a free slot; false for an
   * instructor, who only ever sees their own week.
   */
  canPickInstructor = input<boolean>(false);

  /** What each instructor has actually declared, rather than an assumed 9-to-6. */
  availability = input<InstructorAvailability[]>([]);
  timeOff = input<InstructorTimeOff[]>([]);

  sessionSelected = output<ScheduleSession>();

  selectedInstructorId = signal<number>(0);

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

  readonly instructorOptions = computed(() => {
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

  readonly selectedInstructor = computed(() => {
    const id = this.selectedInstructorId();
    const list = this.instructorOptions();
    if (id !== 0) {
      const match = list.find((i) => i.id === id);
      if (match) return match;
    }
    return list.length > 0 ? list[0] : null;
  });

  readonly weekDays = computed<DayColumnMeta[]>(() => {
    const startOfWeek = new Date(this.currentWeekStart());
    startOfWeek.setHours(0, 0, 0, 0);
    const dayNames = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const result: DayColumnMeta[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      result.push({
        dayName: dayNames[i],
        date: d,
        formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return result;
  });

  onInstructorChange(id: number): void {
    this.selectedInstructorId.set(id);
  }

  getInstructorSlotState(
    date: Date,
    hour: number
  ): { isWorkingHour: boolean; onLeave: boolean; session?: ScheduleSession } {
    const inst = this.selectedInstructor();
    if (!inst) return { isWorkingHour: false, onLeave: false };

    const onLeave = isOnLeave(this.timeOff(), inst.id, date, hour);
    const isWorkingHour = !onLeave && isDeclaredAvailable(this.availability(), inst.id, date, hour);

    const session = this.sessions().find((s) => {
      const isSameInst =
        s.instructorId === inst.id ||
        (s.instructorName && s.instructorName.toLowerCase().includes(inst.name.toLowerCase()));
      if (!isSameInst) return false;

      const d = new Date(s.startsAt);
      const sameDay =
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate();
      if (!sameDay) return false;

      return d.getHours() === hour;
    });

    return { isWorkingHour, onLeave, session };
  }

  readonly weeklyBookedCount = computed(() => {
    let count = 0;
    for (const day of this.weekDays()) {
      for (const slot of this.timeSlots) {
        if (this.getInstructorSlotState(day.date, slot.hour).session) {
          count++;
        }
      }
    }
    return count;
  });

  /**
   * Hours actually taught this week, from the sessions themselves rather than
   * from counting grid cells — a session can be 90 minutes, and the grid is
   * hourly.
   */
  readonly weeklyHours = computed(() => {
    const inst = this.selectedInstructor();
    if (!inst) return 0;

    const days = this.weekDays().map((d) => d.date.toDateString());
    const minutes = this.sessions()
      .filter((s) => {
        if (!s.startsAt || s.instructorId !== inst.id) return false;
        if ((s.status ?? '').toLowerCase().includes('cancel')) return false;
        return days.includes(new Date(s.startsAt).toDateString());
      })
      .reduce((total, s) => {
        const start = new Date(s.startsAt).getTime();
        const end = s.endsAt
          ? new Date(s.endsAt).getTime()
          : start + (s.durationMinutes || 90) * 60000;
        return total + Math.max(0, end - start) / 60000;
      }, 0);

    return Math.round((minutes / 60) * 10) / 10;
  });

  /** The agreed weekly limit in hours, or null where none is set. */
  readonly capacityHours = computed(() => {
    const minutes = this.selectedInstructor()?.weeklyCapacityMinutes;
    return minutes ? Math.round((minutes / 60) * 10) / 10 : null;
  });

  readonly capacityUsedPercent = computed(() => {
    const capacity = this.capacityHours();
    if (!capacity) return 0;
    return Math.min(100, Math.round((this.weeklyHours() / capacity) * 100));
  });

  readonly isOverCapacity = computed(() => {
    const capacity = this.capacityHours();
    return !!capacity && this.weeklyHours() > capacity;
  });

  readonly weeklyFreeCount = computed(() => {
    let count = 0;
    for (const day of this.weekDays()) {
      for (const slot of this.timeSlots) {
        const state = this.getInstructorSlotState(day.date, slot.hour);
        if (state.isWorkingHour && !state.session) {
          count++;
        }
      }
    }
    return count;
  });

  getInitials(name: string): string {
    return (name || 'I')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
