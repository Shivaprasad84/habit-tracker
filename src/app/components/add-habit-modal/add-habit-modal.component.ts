import { Component, EventEmitter, Output, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../base-modal/base-modal.component';

@Component({
  selector: 'app-add-habit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseModalComponent],
  templateUrl: './add-habit-modal.component.html',
})
export class AddHabitModalComponent implements AfterViewInit {
  @Output() close = new EventEmitter<void>();
  @Output() addHabit = new EventEmitter<string>();
  @ViewChild('habitInput') habitInput!: ElementRef<HTMLInputElement>;

  habitName = signal('');

  ngAfterViewInit(): void {
    setTimeout(() => this.habitInput.nativeElement.focus(), 0);
  }

  onSubmit(): void {
    const name = this.habitName().trim();
    if (name) {
      this.addHabit.emit(name);
      this.habitName.set('');
    }
  }

  onClose(): void {
    this.habitName.set('');
    this.close.emit();
  }
}
