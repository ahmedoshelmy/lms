import { Component, inject, computed } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Role, ROLE_LABELS } from '../../core/interfaces/Role';

/**
 * The signed-in account, read-only.
 *
 * Editing comes back once the server has endpoints for it. Until then nothing
 * here offers a change it cannot make: the password form that used to sit here
 * reported success without ever reaching the server.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private auth = inject(AuthService);

  user = this.auth.currentUser;

  readonly roleName = computed(() => {
    const r = this.user()?.role;
    return r ? ROLE_LABELS[r] : 'User';
  });

  readonly initials = computed(() => {
    const n = this.user()?.name ?? 'User';
    return n
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  roleBadgeClass(): string {
    const r = this.user()?.role;
    if (r === Role.Admin) return 'badge-admin';
    if (r === Role.Instructor) return 'badge-instructor';
    return 'badge-student';
  }
}
