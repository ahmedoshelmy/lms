import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Role, ROLE_LABELS } from '../../../core/interfaces/Role';

interface DemoAccount {
  name: string;
  email: string;
  password: string;
  role: Role;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="auth-shell">
      <div class="auth-shell__glow auth-shell__glow--left"></div>
      <div class="auth-shell__glow auth-shell__glow--right"></div>

      <div class="auth-shell__content">
        <div class="auth-card">
          <div class="auth-card__header">
            <div class="auth-card__logo">
              <i class="pi pi-graduation-cap" aria-hidden="true"></i>
            </div>
            <h1 class="auth-card__title">Welcome back</h1>
            <p class="auth-card__subtitle">Sign in to access your schedule</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-field">
              <label for="email">Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                placeholder="you@example.com"
                autocomplete="email"
                [class.invalid]="emailControl.invalid && emailControl.touched"
              />
              @if (emailControl.invalid && emailControl.touched) {
                <span class="field-error">Enter a valid email address.</span>
              }
            </div>

            <div class="form-field">
              <label for="password">Password</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                placeholder="••••••••"
                autocomplete="current-password"
                [class.invalid]="passwordControl.invalid && passwordControl.touched"
              />
              @if (passwordControl.invalid && passwordControl.touched) {
                <span class="field-error">Password is required.</span>
              }
            </div>

            @if (error()) {
              <span class="field-error">{{ error() }}</span>
            }

            <button type="submit" class="submit-btn" [disabled]="form.invalid || loading()">
              @if (loading()) {
                <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> Signing in…
              } @else {
                Sign in
              }
            </button>
          </form>

          <div class="demo-section">
            <p class="demo-title">Demo accounts — pick one to preview a role</p>
            <div class="demo-grid">
              @for (account of demoAccounts; track account.email) {
                <button type="button" class="demo-btn" (click)="useDemo(account)">
                  <span class="demo-name">{{ account.name }}</span>
                  <span class="demo-role">{{ roleLabel(account.role) }}</span>
                  <span class="demo-cred">pw: {{ account.password }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .auth-shell {
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow: hidden;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    }

    .auth-shell__glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      pointer-events: none;
    }

    .auth-shell__glow--left {
      width: 320px;
      height: 320px;
      top: -80px;
      left: -80px;
      background: var(--color-primary-content);
    }

    .auth-shell__glow--right {
      width: 400px;
      height: 400px;
      bottom: -120px;
      right: -100px;
      background: var(--color-secondary);
    }

    .auth-shell__content {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 420px;
    }

    .auth-card {
      background: var(--color-surface);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      width: 100%;
      text-align: center;
    }

    .auth-card__logo {
      width: 60px;
      height: 60px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary-content);
      font-size: 28px;
      margin: 0 auto 12px;
    }

    .auth-card__title {
      font-size: 24px;
      color: var(--color-text-primary);
      margin: 0;
      font-weight: 700;
    }

    .auth-card__subtitle {
      font-size: 15px;
      color: var(--color-text-muted);
      margin: 8px 0 0;
    }

    .form-field {
      margin-bottom: 16px;
      text-align: left;
    }

    .form-field label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-secondary);
      margin-bottom: 6px;
    }

    .form-field input {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid var(--color-border);
      border-radius: 10px;
      font-size: 14px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
      box-sizing: border-box;
    }

    .form-field input:focus {
      outline: none;
      border-color: var(--color-secondary);
      box-shadow: 0 0 0 3px rgba(62, 109, 181, 0.15);
    }

    .form-field input.invalid {
      border-color: var(--color-error);
    }

    .field-error {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      color: var(--color-error);
    }

    .submit-btn {
      width: 100%;
      margin-top: 8px;
      padding: 14px;
      border: none;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      color: var(--color-primary-content);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;
      box-shadow: 0 4px 12px rgba(26, 43, 76, 0.3);
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(26, 43, 76, 0.4);
    }

    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    @media (max-width: 480px) {
      .auth-card {
        padding: 28px 20px;
      }
    }

    .demo-section {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border);
      text-align: left;
    }

    .demo-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-secondary);
      margin: 0 0 12px;
    }

    .demo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .demo-btn {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
      cursor: pointer;
      text-align: left;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .demo-btn:hover {
      border-color: var(--color-secondary);
      box-shadow: 0 2px 8px rgba(62, 109, 181, 0.12);
    }

    .demo-name {
      font-size: 13px;
      font-weight: 600;
    }

    .demo-role {
      font-size: 11px;
      color: var(--color-secondary);
      font-weight: 600;
    }

    .demo-cred {
      font-size: 10px;
      color: var(--color-text-muted);
    }
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  // Demo accounts for previewing role-based views during demos.
  // Passwords are sequential 1..8. Replace with real auth once wired.
  demoAccounts: DemoAccount[] = [
    { name: 'LMS Admin', email: 'admin@lms.com', password: 'pass2word', role: Role.Admin },
    { name: 'John Doe', email: 'john.doe@lms.com', password: 'pass2word', role: Role.Instructor },
  ];

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get emailControl() {
    return this.form.controls.email;
  }

  get passwordControl() {
    return this.form.controls.password;
  }

  roleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }

  useDemo(account: DemoAccount): void {
    this.form.setValue({ email: account.email, password: account.password });
    this.submit();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.notify.showSuccess(`Welcome back, ${user.name}`);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Invalid email or password.');
      },
    });
  }
}
