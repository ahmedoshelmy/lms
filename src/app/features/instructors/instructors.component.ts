import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/interfaces/Role';
import { User } from '../../core/interfaces/User';

@Component({
  selector: 'app-instructors',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  templateUrl: './instructors.component.html',
  styleUrl: './instructors.component.scss',
})
export class InstructorsComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);

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
      (inst) => inst.name.toLowerCase().includes(q) || inst.email.toLowerCase().includes(q)
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
      const comp = valA.toString().localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.lms.getInstructors().subscribe({
      next: (data) => {
        this.instructors.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingInstructor.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.showInstructorModal.set(true);
  }

  openEditModal(instructor: User): void {
    this.editingInstructor.set(instructor);
    this.formName.set(instructor.name);
    this.formEmail.set(instructor.email);
    this.formPassword.set('');
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

    this.saving.set(true);

    if (this.editingInstructor()) {
      const id = this.editingInstructor()!.id;
      this.lms
        .updateUser(id, {
          name,
          email,
          role: Role.Instructor,
          password: password || undefined,
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

  confirmDelete(): void {
    const instructor = this.deletingInstructor();
    if (!instructor) return;

    this.saving.set(true);
    this.lms.deleteUser(instructor.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Instructor ${instructor.name} deleted.`);
        this.saving.set(false);
        this.showDeleteModal.set(false);
        this.deletingInstructor.set(null);
        this.loadData();
      },
      error: () => {
        this.saving.set(false);
      },
    });
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
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
