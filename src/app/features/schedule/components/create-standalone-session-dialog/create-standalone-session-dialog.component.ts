import { Component, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LmsService } from '../../../../core/services/lms.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { User } from '../../../../core/interfaces/User';
import { SessionType } from '../../../../core/enums/SessionType';
import { CreateStandaloneSessionPayload } from '../../../../core/interfaces/ScheduleSession';

@Component({
  selector: 'app-create-standalone-session-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  templateUrl: './create-standalone-session-dialog.component.html',
  styleUrl: './create-standalone-session-dialog.component.scss',
})
export class CreateStandaloneSessionDialogComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  visible = input<boolean>(false);
  instructors = input<User[]>([]);
  close = output<void>();
  sessionCreated = output<void>();

  students = signal<User[]>([]);
  loadingStudents = signal<boolean>(false);
  submitting = signal<boolean>(false);

  // Form State
  sessionType = signal<number>(SessionType.TrialSession);
  instructorId = signal<number | null>(null);
  topic = signal<string>('');
  location = signal<string>('MOA');
  selectedStudentIds = signal<number[]>([]);

  // Date and Time
  sessionDate = signal<string>(new Date().toISOString().split('T')[0]);
  startTime = signal<string>('15:00');
  durationMinutes = signal<number>(45);

  SessionTypeEnum = SessionType;

  ngOnInit(): void {
    this.fetchStudents();
  }

  fetchStudents(): void {
    this.loadingStudents.set(true);
    this.lmsService.getStudents().subscribe({
      next: (data) => {
        this.students.set(data);
        this.loadingStudents.set(false);
      },
      error: () => {
        this.loadingStudents.set(false);
      },
    });
  }

  toggleStudentSelection(studentId: number): void {
    const current = this.selectedStudentIds();
    if (current.includes(studentId)) {
      this.selectedStudentIds.set(current.filter((id) => id !== studentId));
    } else {
      this.selectedStudentIds.set([...current, studentId]);
    }
  }

  onSave(): void {
    if (!this.instructorId()) {
      this.notify.showError('Please select an instructor.');
      return;
    }
    if (!this.topic().trim()) {
      this.notify.showError('Please enter a topic or title.');
      return;
    }
    if (!this.sessionDate() || !this.startTime()) {
      this.notify.showError('Please specify date and start time.');
      return;
    }

    const startDateTime = new Date(`${this.sessionDate()}T${this.startTime()}:00`);
    const endDateTime = new Date(startDateTime.getTime() + this.durationMinutes() * 60000);

    const payload: CreateStandaloneSessionPayload = {
      instructorId: Number(this.instructorId()),
      type: Number(this.sessionType()),
      startsAt: startDateTime.toISOString(),
      endsAt: endDateTime.toISOString(),
      topic: this.topic().trim(),
      location: this.location().trim() || undefined,
      studentIds: this.selectedStudentIds().length > 0 ? this.selectedStudentIds() : undefined,
    };

    this.submitting.set(true);
    this.lmsService.createStandaloneSession(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.notify.showSuccess(
          `Standalone session "${created.topic}" created successfully.`
        );
        this.resetForm();
        this.sessionCreated.emit();
        this.close.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.message || 'Failed to create standalone session.';
        this.notify.showError(msg);
      },
    });
  }

  resetForm(): void {
    this.sessionType.set(SessionType.TrialSession);
    this.instructorId.set(null);
    this.topic.set('');
    this.location.set('MOA');
    this.selectedStudentIds.set([]);
    this.durationMinutes.set(45);
  }

  onCancel(): void {
    this.resetForm();
    this.close.emit();
  }
}
