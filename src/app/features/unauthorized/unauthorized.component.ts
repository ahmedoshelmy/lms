import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="unauthorized-shell">
      <div class="unauthorized-card">
        <div class="icon">
          <i class="pi pi-lock" aria-hidden="true"></i>
        </div>
        <h1>Access Denied</h1>
        <p>You don't have permission to view this page.</p>
        <a routerLink="/" class="btn btn-primary">Back to Schedule</a>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .unauthorized-shell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    }

    .unauthorized-card {
      background: var(--color-surface);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 420px;
      text-align: center;
    }

    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        var(--color-error) 0%,
        var(--color-error-foreground) 100%
      );
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
    }

    .icon i {
      font-size: 36px;
      color: var(--color-primary-content);
    }

    h1 {
      font-size: 28px;
      color: var(--color-text-primary);
      margin: 0 0 12px;
      font-weight: 700;
    }

    p {
      font-size: 16px;
      color: var(--color-text-muted);
      margin: 0 0 32px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 32px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      color: var(--color-primary-content);
      box-shadow: 0 4px 12px rgba(26, 43, 76, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(26, 43, 76, 0.4);
    }
  `,
})
export class UnauthorizedComponent {}
