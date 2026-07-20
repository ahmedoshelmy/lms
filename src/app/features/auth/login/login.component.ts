import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);

  // Demo accounts for previewing role-based views during demos.
  // Passwords are sequential 1..8. Replace with real auth once wired.
  demoAccounts: DemoAccount[] = [
    { name: 'LMS Admin', email: 'admin@lms.com', password: 'pass2word', role: Role.Admin },
    {
      name: 'Mohamed Adel',
      email: 'mohamed.adel@lms.com',
      password: 'pass2word',
      role: Role.Instructor,
    },
    { name: 'Tasneem', email: 'tasneem@lms.com', password: 'pass2word', role: Role.Instructor },
    {
      name: 'Ahmed Saeed',
      email: 'ahmed.saeed@lms.com',
      password: 'pass2word',
      role: Role.Instructor,
    },
    { name: 'Othman', email: 'othman@lms.com', password: 'pass2word', role: Role.Instructor },
    {
      name: 'Mahmoud Khalaf',
      email: 'mahmoud.khalaf@lms.com',
      password: 'pass2word',
      role: Role.Instructor,
    },
    { name: 'Salma', email: 'salma@lms.com', password: 'pass2word', role: Role.Instructor },
    {
      name: 'Mahmoud Khaled',
      email: 'mahmoud.khaled@lms.com',
      password: 'pass2word',
      role: Role.Instructor,
    },
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
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Invalid email or password.');
      },
    });
  }
}
