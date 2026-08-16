import { Component, input, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ScheduleSession } from '../../../../core/interfaces/ScheduleSession';
import { User } from '../../../../core/interfaces/User';

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
            @if (isAdmin()) {
              View weekly workload and availability for an individual instructor
            } @else {
              Your weekly workload and availability for this week
            }
          </p>
        </div>

        <!-- Instructor Filter Dropdown — Admin only -->
        @if (isAdmin()) {
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
          </div>
        </div>
      }

      <div class="overflow-x-auto min-w-[900px]">
        <table class="w-full border-collapse text-left text-xs">
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
                        Off
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
  isAdmin = input<boolean>(false);

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
  ): { isWorkingHour: boolean; session?: ScheduleSession } {
    const inst = this.selectedInstructor();
    if (!inst) return { isWorkingHour: false };

    const isWorkingHour = hour >= 9 && hour < 18;

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

    return { isWorkingHour, session };
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
