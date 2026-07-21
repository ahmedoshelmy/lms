import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

const STUB_STYLES = `
`;

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.scss',
})
export class ResourcesComponent {}
