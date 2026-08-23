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
  template: `
    <div class="p-6 md:p-10 max-w-3xl mx-auto min-h-screen">
      <div class="mb-8">
        <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
          Settings
        </h1>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">
          Settings for this browser. They affect nobody else.
        </p>
      </div>

      <!-- API Configuration Card -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-icon">
            <i class="pi pi-server"></i>
          </div>
          <div>
            <h2 class="settings-card__title">API Endpoint</h2>
            <p class="settings-card__subtitle">
              Which server this browser talks to. Stored on this device only.
            </p>
          </div>
        </div>

        <div class="settings-card__body">
          <label for="api-url" class="settings-label">Base URL</label>
          <div class="input-row">
            <input
              id="api-url"
              type="url"
              [(ngModel)]="apiUrl"
              placeholder="https://example.com/api"
              class="settings-input"
              [class.input-changed]="apiUrl !== currentSavedUrl()"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          @if (apiUrl !== currentSavedUrl()) {
            <p class="text-xs text-[var(--color-warning)] mt-2 flex items-center gap-1.5">
              <i class="pi pi-exclamation-triangle"></i> Unsaved changes
            </p>
          }

          <div class="flex gap-3 mt-5">
            <button
              type="button"
              class="btn-primary"
              (click)="saveUrl()"
              [disabled]="!apiUrl.trim() || apiUrl === currentSavedUrl()"
            >
              <i class="pi pi-check mr-2"></i> Save
            </button>
            <button type="button" class="btn-secondary" (click)="resetUrl()">
              <i class="pi pi-refresh mr-2"></i> Reset to Default
            </button>
          </div>
        </div>
      </div>

      <!-- Health Check & Diagnostics Card -->
      <div class="settings-card mt-6">
        <div class="settings-card__header">
          <div class="settings-icon settings-icon--info">
            <i class="pi pi-heart-fill"></i>
          </div>
          <div>
            <h2 class="settings-card__title">Connection & Cache Diagnostics</h2>
            <p class="settings-card__subtitle">Test API latency and manage local storage cache</p>
          </div>
        </div>
        <div class="settings-card__body space-y-4">
          <div
            class="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-[var(--color-border)]"
          >
            <div>
              <p class="text-sm font-bold text-[var(--color-text-primary)]">
                Backend Server Health
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">
                Ping current API base URL endpoint
              </p>
            </div>
            <div class="flex items-center gap-3">
              @if (healthStatus()) {
                <span
                  class="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                  [ngClass]="
                    healthStatus() === 'healthy'
                      ? 'bg-[var(--color-success-background)] text-[var(--color-success-foreground)] border border-[var(--color-success)]'
                      : 'bg-[var(--color-error-background)] text-[var(--color-error-foreground)] border border-[var(--color-error)]'
                  "
                >
                  <i
                    [class]="
                      healthStatus() === 'healthy'
                        ? 'pi pi-check-circle'
                        : 'pi pi-exclamation-triangle'
                    "
                  ></i>
                  {{
                    healthStatus() === 'healthy'
                      ? 'Online (' + latencyMs() + 'ms)'
                      : 'Offline / Error'
                  }}
                </span>
              }
              <button
                type="button"
                class="btn-secondary"
                (click)="pingHealth()"
                [disabled]="pinging()"
              >
                @if (pinging()) {
                  <i class="pi pi-spinner pi-spin mr-2"></i> Testing…
                } @else {
                  <i class="pi pi-bolt mr-2 text-[var(--color-warning)]"></i> Test Connection
                }
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 flex-wrap pt-2">
            <div>
              <p class="text-sm font-bold text-[var(--color-text-primary)]">
                Offline Local Storage Cache
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">
                Clear cached attendance sheets and offline fallback state
              </p>
            </div>
            <button type="button" class="btn-secondary" (click)="clearCache()">
              <i class="pi pi-trash mr-2 text-[var(--color-error)]"></i> Clear Cache
            </button>
          </div>
        </div>
      </div>

      <!-- App Info Card -->
      <div class="settings-card mt-6">
        <div class="settings-card__header">
          <div class="settings-icon settings-icon--info">
            <i class="pi pi-info-circle"></i>
          </div>
          <div>
            <h2 class="settings-card__title">Application Info</h2>
            <p class="settings-card__subtitle">Current system information</p>
          </div>
        </div>
        <div class="settings-card__body">
          <dl class="info-grid">
            <div class="info-row">
              <dt>Current API URL</dt>
              <dd>{{ currentSavedUrl() }}</dd>
            </div>
            <div class="info-row">
              <dt>Framework</dt>
              <dd>Angular 21 (Standalone)</dd>
            </div>
            <div class="info-row">
              <dt>UI Library</dt>
              <dd>PrimeNG with Aura theme</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .settings-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    .settings-card__header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-secondary);
    }
    .settings-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      flex-shrink: 0;
    }
    .settings-icon--info {
      background: linear-gradient(135deg, var(--color-info) 0%, var(--color-secondary) 100%);
    }
    .settings-card__title {
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text-primary);
      margin: 0;
    }
    .settings-card__subtitle {
      font-size: 13px;
      color: var(--color-text-muted);
      margin: 2px 0 0;
    }
    .settings-card__body {
      padding: 24px;
    }

    .settings-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }
    .input-row {
      display: flex;
      gap: 0;
    }
    .settings-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid var(--color-border);
      border-radius: 10px;
      font-size: 14px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-family: monospace;
      transition:
        border-color 0.2s,
        box-shadow 0.2s;
      outline: none;
    }
    .settings-input:focus {
      border-color: var(--color-secondary);
      box-shadow: 0 0 0 3px rgba(62, 109, 181, 0.12);
    }
    .settings-input.input-changed {
      border-color: var(--color-warning);
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      padding: 10px 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      color: var(--color-primary-content);
      transition:
        opacity 0.2s,
        transform 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 10px 20px;
      border-radius: 10px;
      border: 1px solid var(--color-border);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      transition: all 0.2s;
    }
    .btn-secondary:hover {
      border-color: var(--color-secondary);
      color: var(--color-secondary);
    }

    .info-grid {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin: 0;
    }
    .info-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border);
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-row dt {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--color-text-muted);
    }
    .info-row dd {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary);
      margin: 0;
      font-family: monospace;
    }
  `,
})
export class SettingsComponent {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  currentSavedUrl = signal(this.lms.getApiUrl());
  apiUrl = this.lms.getApiUrl();

  pinging = signal(false);
  healthStatus = signal<'healthy' | 'unhealthy' | null>(null);
  latencyMs = signal<number>(0);

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

  pingHealth(): void {
    this.pinging.set(true);
    this.healthStatus.set(null);
    const start = performance.now();

    this.lms.getSchedule().subscribe({
      next: () => {
        const elapsed = Math.round(performance.now() - start);
        this.latencyMs.set(elapsed);
        this.healthStatus.set('healthy');
        this.pinging.set(false);
        this.notify.showSuccess(`Backend server reachable (${elapsed}ms latency).`);
      },
      error: () => {
        this.healthStatus.set('unhealthy');
        this.pinging.set(false);
        this.notify.showError('Backend server ping failed or unreachable.');
      },
    });
  }

  clearCache(): void {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lms_attendance_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      this.notify.showSuccess(`Cleared ${keysToRemove.length} cached attendance record(s).`);
    }
  }
}
