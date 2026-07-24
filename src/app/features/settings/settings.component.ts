import { Component, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  currentSavedUrl = signal(this.lms.getApiUrl());
  apiUrl = this.lms.getApiUrl();

  constructor() {
    this.lms.apiUrl$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((url) => {
      this.currentSavedUrl.set(url);
      this.apiUrl = url;
    });
  }

  saveUrl(): void {
    const trimmed = this.apiUrl.trim();
    if (!trimmed) return;
    this.lms.setApiUrl(trimmed);
    this.notify.showSuccess('API URL updated successfully.');
  }

  resetUrl(): void {
    this.lms.resetApiUrl();
    this.notify.showInfo('API URL reset to default.');
  }
}
