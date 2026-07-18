import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from '../auth/login/login.component';
import { ScheduleComponent } from '../schedule/schedule.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LoginComponent, ScheduleComponent],
  templateUrl: './home.component.html',
  styles: `
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }
  `,
})
export class HomeComponent {
  protected auth = inject(AuthService);
}
