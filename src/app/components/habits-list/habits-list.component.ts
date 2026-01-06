import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Habit } from '../../models/habit.model';
import { DeleteConfirmationModalComponent } from '../delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
  selector: 'app-habits-list',
  standalone: true,
  imports: [CommonModule, DeleteConfirmationModalComponent],
  templateUrl: './habits-list.component.html',
})
export class HabitsListComponent {
  @Input() habits: Habit[] = [];
  @Output() updateHabit = new EventEmitter<{ id: number; name: string }>();
  @Output() deleteHabit = new EventEmitter<number>();

  editingHabitId = signal<number | null>(null);
  editingHabitName = signal('');
  showDeleteModal = signal(false);
  habitToDelete = signal<Habit | null>(null);

  startEdit(habit: Habit): void {
    this.editingHabitId.set(habit.id!);
    this.editingHabitName.set(habit.name);
  }

  saveEdit(habitId: number): void {
    const newName = this.editingHabitName().trim();
    if (newName) {
      this.updateHabit.emit({ id: habitId, name: newName });
    }
    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingHabitId.set(null);
    this.editingHabitName.set('');
  }

  openDeleteModal(habit: Habit): void {
    this.habitToDelete.set(habit);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.habitToDelete.set(null);
    this.showDeleteModal.set(false);
  }

  confirmDelete(): void {
    const habit = this.habitToDelete();
    if (habit?.id) {
      this.deleteHabit.emit(habit.id);
    }
    this.closeDeleteModal();
  }
}
