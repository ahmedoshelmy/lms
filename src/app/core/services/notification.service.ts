import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private messageService: MessageService) {}

  showSuccess(content: string) {
    this.messageService.add({ severity: 'success', summary: 'Success', detail: content });
  }

  showInfo(content: string) {
    this.messageService.add({ severity: 'info', summary: 'Info', detail: content });
  }

  showWarn(content: string) {
    this.messageService.add({ severity: 'warn', summary: 'Warn', detail: content });
  }

  showError(content: string) {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: content });
  }

  showContrast(content: string) {
    this.messageService.add({
      severity: 'contrast',
      summary: 'Contrast',
      detail: content,
    });
  }

  showSecondary(content: string) {
    this.messageService.add({
      severity: 'secondary',
      summary: 'Secondary',
      detail: content,
    });
  }
}
