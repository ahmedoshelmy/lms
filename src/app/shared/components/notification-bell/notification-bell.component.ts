import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationCenterService } from '../../../core/services/notification-center.service';
import {
  AppNotification,
  NOTIFICATION_ICONS,
  timeAgo,
} from '../../../core/interfaces/Notification';

/**
 * The bell, its badge, and the panel behind it.
 *
 * Holds no state of its own beyond whether the panel is open — everything else
 * comes from the shared service, so putting a second bell in the mobile header
 * costs nothing and the two can never show different numbers.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  private readonly centre = inject(NotificationCenterService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Hides the word next to the icon where there is no room for it. */
  readonly compact = input(false);

  readonly open = signal(false);
  readonly items = this.centre.items;
  readonly unreadCount = this.centre.unreadCount;

  /** Capped at 9+ so a neglected bell does not stretch its own badge. */
  readonly badge = computed(() => (this.unreadCount() > 9 ? '9+' : String(this.unreadCount())));

  readonly icons = NOTIFICATION_ICONS;
  readonly ago = timeAgo;

  toggle(): void {
    const next = !this.open();
    this.open.set(next);

    // Opening is the moment somebody expects to see the truth, so it is worth
    // a request even if the timer fired thirty seconds ago.
    if (next) {
      this.centre.refresh();
    }
  }

  /**
   * Opens what the notification is about and marks it read on the way. Clicking
   * one you have already read still navigates: the row is a link first.
   */
  activate(notification: AppNotification): void {
    this.centre.markRead(notification);
    this.open.set(false);

    if (notification.linkPath) {
      this.router.navigateByUrl(notification.linkPath);
    }
  }

  markAllRead(event: Event): void {
    event.stopPropagation();
    this.centre.markAllRead();
  }

  /** Clicking anywhere else shuts the panel, which is what a dropdown does. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
