import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/interfaces/Role';
import { Group } from '../../core/interfaces/Group';
import { User } from '../../core/interfaces/User';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);

  students = signal<User[]>([]);
  groups = signal<Group[]>([]);
  loading = signal(false);
  saving = signal(false);
  searchQuery = signal('');

  // Dialog control
  showStudentModal = signal(false);
  showDeleteModal = signal(false);
  editingStudent = signal<User | null>(null);
  deletingStudent = signal<User | null>(null);

  // Form fields
  formName = signal('');
  formEmail = signal('');
  formPassword = signal('');
  formGroupId = signal<string>('');

  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.students().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.groupName && s.groupName.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.lms.getStudents().subscribe({
      next: (data) => {
        this.students.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    this.lms.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups || []);
      },
      error: () => {},
    });
  }

  openCreateModal(): void {
    this.editingStudent.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.formGroupId.set('');
    this.showStudentModal.set(true);
  }

  openEditModal(student: User): void {
    this.editingStudent.set(student);
    this.formName.set(student.name);
    this.formEmail.set(student.email);
    this.formPassword.set('');
    this.formGroupId.set(student.groupId || '');
    this.showStudentModal.set(true);
  }

  openDeleteModal(student: User): void {
    this.deletingStudent.set(student);
    this.showDeleteModal.set(true);
  }

  saveStudent(): void {
    const name = this.formName().trim();
    const email = this.formEmail().trim();
    const password = this.formPassword().trim();
    const groupId = this.formGroupId() || undefined;

    if (!name || !email) {
      this.notify.showWarn('Please enter name and email.');
      return;
    }

    if (!this.editingStudent() && !password) {
      this.notify.showWarn('Password is required for new students.');
      return;
    }

    this.saving.set(true);

    if (this.editingStudent()) {
      const studentId = this.editingStudent()!.id;
      this.lms
        .updateUser(studentId, {
          name,
          email,
          role: Role.Student,
          password: password || undefined,
          groupId: groupId || undefined,
        })
        .subscribe({
          next: () => {
            this.notify.showSuccess('Student updated successfully.');
            this.saving.set(false);
            this.showStudentModal.set(false);
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
          role: Role.Student,
          groupId: groupId || undefined,
        })
        .subscribe({
          next: () => {
            this.notify.showSuccess('Student created successfully.');
            this.saving.set(false);
            this.showStudentModal.set(false);
            this.loadData();
          },
          error: () => {
            this.saving.set(false);
          },
        });
    }
  }

  confirmDelete(): void {
    const student = this.deletingStudent();
    if (!student) return;

    this.saving.set(true);
    this.lms.deleteUser(student.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Student ${student.name} deleted.`);
        this.saving.set(false);
        this.showDeleteModal.set(false);
        this.deletingStudent.set(null);
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
