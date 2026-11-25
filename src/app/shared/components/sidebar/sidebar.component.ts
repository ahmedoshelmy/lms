import {
  Component,
  computed,
  inject,
  input,
  model,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { MenuItem } from '../../../core/interfaces/MenuItem';
import { ROLE_LABELS } from '../../../core/interfaces/Role';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { getMenuItemsForRole } from '../../../core/config/app-navigation.config';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { ClockFormatService } from '../../../core/services/clock-format.service';
import { SessionService } from '../../../core/services/session.service';
import { PwaService } from '../../../core/services/pwa.service';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterModule, NotificationBellComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly session = inject(SessionService);
  protected readonly pwa = inject(PwaService);
  private readonly themeService = inject(ThemeService);
  /** Public: the template toggles it directly. */
  protected readonly clock = inject(ClockFormatService);
  private readonly router = inject(Router);

  readonly isDark = this.themeService.isDark;

  isOpen = model(true);
  /** A drawer over the page (phones) rather than a column that collapses. */
  readonly drawer = input(false);
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

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    void this.session.askToSignOut();
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
