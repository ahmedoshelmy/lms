import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6">Progress view is currently disabled.</div>`
})
export class ProgressComponent {}
