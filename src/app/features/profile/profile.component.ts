import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role, ROLE_LABELS } from '../../core/interfaces/Role';

type ProfileTab = 'details' | 'security' | 'preferences';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  user = this.auth.currentUser;
  activeTab = signal<ProfileTab>('details');

  savingDetails = signal(false);
  savingSecurity = signal(false);

  emailNotifs = signal(true);
  sessionReminders = signal(true);
  weeklyDigest = signal(false);

  detailsForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    title: [''],
  });

  securityForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => {
        const pass = group.get('newPassword')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return pass === confirm ? null : { mismatch: true };
      },
    }
  );

  get nameCtrl() {
    return this.detailsForm.controls.name;
  }
  get emailCtrl() {
    return this.detailsForm.controls.email;
  }
  get currPassCtrl() {
    return this.securityForm.controls.currentPassword;
  }
  get newPassCtrl() {
    return this.securityForm.controls.newPassword;
  }
  get confirmPassCtrl() {
    return this.securityForm.controls.confirmPassword;
  }

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

  ngOnInit(): void {
    const u = this.user();
    if (u) {
      this.detailsForm.patchValue({
        name: u.name,
        email: u.email,
      });
    }
  }

  roleBadgeClass(): string {
    const r = this.user()?.role;
    if (r === Role.Admin) return 'badge-admin';
    if (r === Role.Instructor) return 'badge-instructor';
    return 'badge-student';
  }

  saveDetails(): void {
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    this.savingDetails.set(true);
    const val = this.detailsForm.getRawValue();

    // Update global user state reactively
    this.auth.updateProfile(val);
    this.savingDetails.set(false);
    this.notify.showSuccess('Profile details updated successfully!');
  }

  changePassword(): void {
    if (this.securityForm.invalid) {
      this.securityForm.markAllAsTouched();
      return;
    }

    this.savingSecurity.set(true);

    setTimeout(() => {
      this.securityForm.reset();
      this.savingSecurity.set(false);
      this.notify.showSuccess('Password updated successfully!');
    }, 600);
  }

  savePreferences(): void {
    this.notify.showSuccess('Preferences saved successfully!');
  }
}
