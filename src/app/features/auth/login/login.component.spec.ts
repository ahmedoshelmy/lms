import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginComponent } from './login.component';

function render(login = vi.fn()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { login } },
      { provide: NotificationService, useValue: { showSuccess: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(LoginComponent);
  document.body.appendChild(fixture.nativeElement);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, page: fixture.componentInstance };
}

describe('LoginComponent', () => {
  it('ties each field to its error, and puts the focus on the first to fix', async () => {
    const { fixture, el, page } = render();
    await fixture.whenStable();

    page.submit();
    await fixture.whenStable();

    const email = el.querySelector<HTMLInputElement>('#email')!;
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe('email-error');
    expect(el.querySelector('#email-error')?.textContent).toContain('valid email');
    expect(document.activeElement).toBe(email);
  });

  it('reads out a failed sign-in as it appears', async () => {
    const login = vi.fn(() => throwError(() => ({ error: { message: 'Wrong password.' } })));
    const { fixture, el, page } = render(login);
    page.form.setValue({ email: 'a@example.test', password: 'nope' });

    page.submit();
    await fixture.whenStable();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe('Wrong password.');
  });
});
