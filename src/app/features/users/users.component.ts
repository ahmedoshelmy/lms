import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, User } from '../../core/services/lms.service';
import { ROLE_LABELS, Role } from '../../core/interfaces/Role';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);

  users = signal<User[]>([]);
  loading = signal(false);
  searchQuery = signal('');

  filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.users().filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q)
    );
  });

  roleChips = computed(() => {
    const all = this.users();
    return [
      {
        role: Role.Admin,
        label: 'Admin',
        count: all.filter((u) => u.role === Role.Admin).length,
        icon: 'pi pi-shield',
        color: 'var(--color-primary)',
      },
      {
        role: Role.Instructor,
        label: 'Instructor',
        count: all.filter((u) => u.role === Role.Instructor).length,
        icon: 'pi pi-user',
        color: 'var(--color-secondary)',
      },
      {
        role: Role.Student,
        label: 'Student',
        count: all.filter((u) => u.role === Role.Student).length,
        icon: 'pi pi-graduation-cap',
        color: 'var(--color-success)',
      },
    ].filter((c) => c.count > 0);
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.lms.getUsers().subscribe({
      next: (users) => {
        this.users.set(users || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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

  roleLabel(role: Role): string {
    return ROLE_LABELS[role] ?? 'Unknown';
  }

  roleBadgeClass(role: Role): string {
    if (role === Role.Admin) return 'badge-admin';
    if (role === Role.Instructor) return 'badge-instructor';
    return 'badge-student';
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
