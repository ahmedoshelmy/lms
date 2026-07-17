import { Component, computed, inject, model, output } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenuItem } from '../../../core/interfaces/MenuItem';
import { ROLE_LABELS } from '../../../core/interfaces/Role';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { getMenuItemsForRole } from '../../../core/config/app-navigation.config';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly lmsService = inject(LmsService);
  private readonly router = inject(Router);

  isOpen = model(true);
  menuItemClicked = output<void>();

  private readonly currentUser = this.authService.currentUser;

  readonly menuItems = computed<MenuItem[]>(() => {
    const user = this.currentUser();
    return user ? getMenuItemsForRole(user.role) : [];
  });

  readonly userProfile = computed(() => {
    const user = this.currentUser();
    return {
      initials: this.getUserInitials(user?.name ?? 'User'),
      name: user?.name ?? 'User',
      email: user?.email ?? '',
    };
  });

  readonly currentRole = computed(() => {
    const role = this.currentUser()?.role;
    return role ? ROLE_LABELS[role] : 'Guest';
  });

  onMenuItemClick(): void {
    this.menuItemClicked.emit();
  }

  toggleSidebar(): void {
    this.isOpen.update((value) => !value);
  }

  logout(): void {
    this.lmsService.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  private finishLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  private getUserInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
