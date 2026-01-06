import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-base-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './base-modal.component.html',
})
export class BaseModalComponent {
  @Input() title = '';
  @Output() close = new EventEmitter<void>();

  onBackdropClick(): void {
    this.close.emit();
  }

  onContentClick(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close.emit();
  }
}
