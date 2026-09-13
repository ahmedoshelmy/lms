import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { RegisterComplianceComponent } from './register-compliance/register-compliance.component';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/interfaces/Role';
import { User } from '../../core/interfaces/User';
import { InstructorWorkload } from '../../core/interfaces/InstructorWorkload';

@Component({
  selector: 'app-instructors',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, RegisterComplianceComponent],
  templateUrl: './instructors.component.html',
  styleUrl: './instructors.component.scss',
})
export class InstructorsComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private router = inject(Router);

  instructors = signal<User[]>([]);
  loading = signal(false);
  saving = signal(false);
  searchQuery = signal('');

  // Dialog control
  showInstructorModal = signal(false);
  showDeleteModal = signal(false);
  editingInstructor = signal<User | null>(null);
  deletingInstructor = signal<User | null>(null);

  // Form fields
  formName = signal('');
  formEmail = signal('');
  formPassword = signal('');

  /**
   * The most they should teach in a week, in hours, as typed. Empty means no
   * ceiling — which is what every instructor had until now, because the field
   * existed on the record with nowhere to set it.
   */
  formWeeklyHours = signal<string>('');

  /** Booked, offered and capped, for the whole team. */
  workload = signal<InstructorWorkload[]>([]);

  /** Keyed by instructor, so a table row can find its own figures. */
  readonly workloadById = computed(() => {
    const map = new Map<number, InstructorWorkload>();
    for (const row of this.workload()) map.set(row.instructorId, row);
    return map;
  });

  /** Anyone booked beyond the ceiling somebody set for them. */
  readonly overCapacity = computed(() =>
    this.workload().filter((w) => w.capacityHours != null && w.scheduledHours > w.capacityHours)
  );

  /** Booked past what they said they could teach — a different problem. */
  readonly overAvailability = computed(() =>
    this.workload().filter((w) => w.hasAvailability && w.scheduledHours > w.availableHours)
  );

  /** Nobody has asked them when they can teach. */
  readonly withoutAvailability = computed(() => this.workload().filter((w) => !w.hasAvailability));

  readonly teamScheduledHours = computed(
    () => Math.round(this.workload().reduce((sum, w) => sum + w.scheduledHours, 0) * 10) / 10
  );

  readonly teamAvailableHours = computed(
    () => Math.round(this.workload().reduce((sum, w) => sum + w.availableHours, 0) * 10) / 10
  );

  /**
   * How full their week is, as a percentage.
   *
   * Measured against the limit where somebody set one, and against what they
   * offered otherwise — a bar with no denominator says nothing. Capped at 100
   * so a bar cannot run past its track, though the figure beside it still
   * shows the real overrun.
   */
  loadPercent(row: InstructorWorkload): number {
    const ceiling = row.capacityHours ?? (row.hasAvailability ? row.availableHours : 0);
    if (!ceiling) return 0;
    return Math.min(100, Math.round((row.scheduledHours / ceiling) * 100));
  }

  /** Hours they offered that nothing has been booked into yet. */
  freeHours(row: InstructorWorkload): number {
    return Math.round((row.availableHours - row.scheduledHours) * 10) / 10;
  }

  // Sorting state
  sortColumn = signal<string>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  toggleSort(col: string): void {
    if (this.sortColumn() === col) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(col: string): string {
    if (this.sortColumn() !== col) return 'pi-sort-alt text-[var(--color-text-muted)] opacity-40';
    return this.sortDirection() === 'asc'
      ? 'pi-sort-amount-up-alt text-[var(--color-secondary)] font-bold'
      : 'pi-sort-amount-down text-[var(--color-secondary)] font-bold';
  }

  filteredInstructors = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.instructors().filter(
      (inst) => inst.name.toLowerCase().includes(q) || (inst.email || '').toLowerCase().includes(q)
    );

    const col = this.sortColumn();
    const dir = this.sortDirection();

    return list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (col === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (col === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (col === 'role') {
        valA = a.role || '';
        valB = b.role || '';
      } else if (col === 'joined') {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return dir === 'asc' ? valA - valB : valB - valA;
      }
      const comp = valA
        .toString()
        .localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    // Everyone, including those who have left, so an account switched off by
    // mistake can be switched back on from here.
    this.lms.getAllInstructorAccounts().subscribe({
      next: (data) => {
        this.instructors.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    // Separate call, and deliberately not blocking the list: the roster is
    // what the page is for, and the week's figures are worth waiting for
    // separately rather than holding the names back.
    this.lms.getInstructorWorkload().subscribe({
      next: (data) => this.workload.set(data || []),
      error: () => this.workload.set([]),
    });
  }

  openCreateModal(): void {
    this.editingInstructor.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');

    this.formWeeklyHours.set('');
    this.showInstructorModal.set(true);
  }

  openEditModal(instructor: User): void {
    this.editingInstructor.set(instructor);
    this.formName.set(instructor.name);
    this.formEmail.set(instructor.email || '');
    this.formPassword.set('');

    this.formWeeklyHours.set(
      instructor.weeklyCapacityMinutes ? String(instructor.weeklyCapacityMinutes / 60) : ''
    );
    this.showInstructorModal.set(true);
  }

  openDeleteModal(instructor: User): void {
    this.deletingInstructor.set(instructor);
    this.showDeleteModal.set(true);
  }

  saveInstructor(): void {
    const name = this.formName().trim();
    const email = this.formEmail().trim();
    const password = this.formPassword().trim();

    if (!name || !email) {
      this.notify.showWarn('Please enter name and email.');
      return;
    }

    if (!this.editingInstructor() && !password) {
      this.notify.showWarn('Password is required for new instructors.');
      return;
    }

    // Typed in hours because that is how the school talks about a teaching
    // week; stored in minutes because a session is not always a whole hour.
    const hours = Number(this.formWeeklyHours());
    if (this.formWeeklyHours().trim() && (!Number.isFinite(hours) || hours < 0 || hours > 168)) {
      this.notify.showWarn('A weekly limit must be a number of hours between 0 and 168.');
      return;
    }
    const weeklyCapacityMinutes = this.formWeeklyHours().trim() ? Math.round(hours * 60) : null;

    this.saving.set(true);

    if (this.editingInstructor()) {
      const id = this.editingInstructor()!.id;
      this.lms
        .updateUser(id, {
          name,
          email,
          role: Role.Instructor,
          password: password || undefined,
          weeklyCapacityMinutes,
        })
        .subscribe({
          next: () => {
            this.notify.showSuccess('Instructor updated successfully.');
            this.saving.set(false);
            this.showInstructorModal.set(false);
            this.loadData();
          },
          error: () => {
            this.saving.set(false);
          },
        });
    } else {
      this.lms
        .createUser({
          name,
          email,
          password,
          role: Role.Instructor,
          weeklyCapacityMinutes,
        })
        .subscribe({
          next: () => {
            this.notify.showSuccess('Instructor created successfully.');
            this.saving.set(false);
            this.showInstructorModal.set(false);
            this.loadData();
          },
          error: () => {
            this.saving.set(false);
          },
        });
    }
  }

  /**
   * The usual way to remove somebody who has left. They can no longer sign in
   * and vanish from every picker and schedule, while every class they took
   * and register they marked stays true.
   *
   * Refused while they still have teaching ahead of them; the server names the
   * running groups, and the error interceptor puts that in front of the admin.
   */
  confirmDeactivate(): void {
    const instructor = this.deletingInstructor();
    if (!instructor) return;

    this.saving.set(true);
    this.lms.deactivateUser(instructor.id).subscribe({
      next: () => {
        this.notify.showSuccess(
          `${instructor.name} is deactivated. They can no longer sign in, and their classes and registers are kept.`
        );
        this.closeRemoveDialog();
      },
      error: () => this.saving.set(false),
    });
  }

  /**
   * Removes the account outright. Only possible for one with nothing on
   * record — a mistaken entry or a duplicate. For anybody who has taught, the
   * server refuses and says to deactivate instead; the page cannot see enough
   * history to decide that itself, so it does not try.
   */
  confirmDelete(): void {
    const instructor = this.deletingInstructor();
    if (!instructor) return;

    this.saving.set(true);
    this.lms.deleteUser(instructor.id).subscribe({
      next: () => {
        this.notify.showSuccess(`${instructor.name} deleted.`);
        this.closeRemoveDialog();
      },
      error: () => this.saving.set(false),
    });
  }

  private closeRemoveDialog(): void {
    this.saving.set(false);
    this.showDeleteModal.set(false);
    this.deletingInstructor.set(null);
    this.loadData();
  }

  reactivate(instructor: User): void {
    this.saving.set(true);
    this.lms.reactivateUser(instructor.id).subscribe({
      next: () => {
        this.notify.showSuccess(`${instructor.name} can sign in again.`);
        this.saving.set(false);
        this.loadData();
      },
      error: () => this.saving.set(false),
    });
  }

  isDeactivated(instructor: User): boolean {
    return !!instructor.deactivatedAt;
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDate(iso?: string): string {
    if (!iso) return 'â€”';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  viewInstructor(instructor: User): void {
    this.router.navigate(['/instructors', instructor.id]);
  }
}
