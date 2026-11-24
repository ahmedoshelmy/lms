import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { OperationsService } from '../../../core/services/operations.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OperationsRotaEntry, WEEK, WeekDay } from '../../../core/interfaces/Operations';

/**
 * Who answers for which day.
 *
 * Everything that needs operations used to go to all five admins at once,
 * which is the same as going to nobody in particular: each of them could
 * reasonably assume one of the others had it. Two of the five are not on
 * operations at all and were being told about work they could not act on.
 *
 * Being on operations is simply holding a day. There is no separate switch,
 * because two ways of saying the same thing drift apart, and somebody marked
 * "operations" who holds no day would look on duty while hearing about
 * nothing.
 */
@Component({
  selector: 'app-operations-rota',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  templateUrl: './operations-rota.component.html',
  styleUrl: './operations-rota.component.scss',
})
export class OperationsRotaComponent implements OnInit {
  private operations = inject(OperationsService);
  private notify = inject(NotificationService);

  protected readonly week = WEEK;

  protected loading = signal(true);
  protected saving = signal(false);
  protected admins = signal<OperationsRotaEntry[]>([]);

  /** What is held now, before anybody saves. Keyed by admin. */
  protected held = signal<Record<number, WeekDay[]>>({});

  /** Whether anything has been changed since it was loaded. */
  protected readonly dirty = computed(() => {
    const held = this.held();

    return this.admins().some((admin) => {
      const now = [...(held[admin.userId] ?? [])].sort();
      const before = [...admin.days].sort();
      return now.join() !== before.join();
    });
  });

  /**
   * Days nobody holds, worked out from what is on screen rather than from what
   * was last saved, so the warning appears as the hole is made.
   */
  protected readonly unowned = computed(() => {
    const held = this.held();
    const taken = new Set(Object.values(held).flat());
    return this.week.filter((day) => !taken.has(day));
  });

  /** The admins who hold nothing, named so it is clearly deliberate. */
  protected readonly notOnOperations = computed(() => {
    const held = this.held();
    return this.admins().filter((admin) => (held[admin.userId] ?? []).length === 0);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);

    this.operations.getRota().subscribe({
      next: (rota) => {
        this.admins.set(rota.admins);
        this.held.set(
          Object.fromEntries(rota.admins.map((admin) => [admin.userId, [...admin.days]]))
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected holds(userId: number, day: WeekDay): boolean {
    return (this.held()[userId] ?? []).includes(day);
  }

  protected toggle(userId: number, day: WeekDay): void {
    const held = { ...this.held() };
    const days = held[userId] ?? [];

    held[userId] = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];

    this.held.set(held);
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    const held = this.held();

    const payload = this.admins()
      .map((admin) => ({
        userId: admin.userId,

        // In the order the week runs, so what comes back reads the same way it
        // was set rather than in the order the boxes happened to be ticked.
        days: this.week.filter((day) => (held[admin.userId] ?? []).includes(day)),
      }))
      .filter((entry) => entry.days.length > 0);

    this.operations.saveRota(payload).subscribe({
      next: (rota) => {
        this.admins.set(rota.admins);
        this.held.set(
          Object.fromEntries(rota.admins.map((admin) => [admin.userId, [...admin.days]]))
        );
        this.saving.set(false);
        this.notify.showSuccess('The rota is set.');
      },
      error: () => this.saving.set(false),
    });
  }

  protected revert(): void {
    this.held.set(
      Object.fromEntries(this.admins().map((admin) => [admin.userId, [...admin.days]]))
    );
  }

  /** The admins holding nothing, as a readable list. */
  protected readonly notOnOperationsNames = computed(() =>
    this.notOnOperations()
      .map((admin) => admin.name)
      .join(', ')
  );

  /** Short label for the column head on a narrow screen. */
  protected short(day: WeekDay): string {
    return day.slice(0, 3);
  }
}
