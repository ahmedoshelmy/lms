import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-6">Profile view is currently disabled.</div>`
})
export class ProfileComponent {}
