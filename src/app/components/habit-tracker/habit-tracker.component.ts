import { Component, computed, effect, signal, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { Habit } from '../../models/habit.model';
import { MonthHeaderComponent } from '../month-header/month-header.component';
import { DeleteConfirmationModalComponent } from '../delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
  selector: 'app-habit-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, MonthHeaderComponent, DeleteConfirmationModalComponent],
  templateUrl: './habit-tracker.component.html',
})
export class HabitTrackerComponent implements OnInit {
  @Input() set habits(value: Habit[]) {
    this._habits.set(value);
    this.loadCompletions();
  }
  @Output() habitsChanged = new EventEmitter<void>();

  private _habits = signal<Habit[]>([]);
  showDeleteModal = signal(false);
  habitToDelete = signal<Habit | null>(null);
  editingHabitId = signal<number | null>(null);
  editingHabitName = signal('');

  currentDate = new Date();
  currentYear = this.currentDate.getFullYear();
  currentMonth = this.currentDate.getMonth();

  selectedYear = signal(this.currentYear);
  selectedMonth = signal(this.currentMonth);

  completions = signal<Map<string, boolean>>(new Map());

  monthName = computed(() => {
    const date = new Date(this.selectedYear(), this.selectedMonth(), 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  habitsWithCompletions = computed(() => {
    const habits = this._habits();
    const completionsMap = this.completions();
    
    return habits.map(habit => ({
      habit,
      completions: new Map(
        Array.from({ length: this.getDaysInMonth() }, (_, i) => {
          const day = i + 1;
          const key = this.getCompletionKey(habit.id!, day);
          return [day, completionsMap.get(key) || false];
        })
      )
    }));
  });

  constructor(private db: DatabaseService) {
    effect(() => {
      this.loadCompletions();
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    await this.loadCompletions();
  }

  async loadCompletions() {
    const habits = this._habits();
    const year = this.selectedYear();
    const month = this.selectedMonth();
    
    const completionsMap = new Map<string, boolean>();

    for (const habit of habits) {
      const habitCompletions = await this.db.getCompletions(habit.id!, year, month);
      habitCompletions.forEach(completion => {
        const key = this.getCompletionKey(habit.id!, completion.day);
        completionsMap.set(key, completion.completed);
      });
    }

    this.completions.set(completionsMap);
  }

  getDaysInMonth(): number {
    return new Date(this.selectedYear(), this.selectedMonth() + 1, 0).getDate();
  }

  getDayArray(): number[] {
    return Array.from({ length: this.getDaysInMonth() }, (_, i) => i + 1);
  }

  isFutureDay(day: number): boolean {
    const selectedYear = this.selectedYear();
    const selectedMonth = this.selectedMonth();
    const today = new Date();
    const cellDate = new Date(selectedYear, selectedMonth, day);
    today.setHours(0, 0, 0, 0);
    cellDate.setHours(0, 0, 0, 0);
    return cellDate.getTime() > today.getTime();
  }

  getCompletionKey(habitId: number, day: number): string {
    return `${habitId}-${day}`;
  }

  async toggleCompletion(habitId: number, day: number) {
    await this.db.toggleCompletion(
      habitId,
      this.selectedYear(),
      this.selectedMonth(),
      day
    );
    await this.loadCompletions();
  }

  startEditHabit(habit: Habit) {
    this.editingHabitId.set(habit.id!);
    this.editingHabitName.set(habit.name);
  }

  async saveHabitName(habitId: number) {
    const newName = this.editingHabitName().trim();
    if (newName && newName !== this._habits().find(h => h.id === habitId)?.name) {
      await this.db.updateHabit(habitId, newName);
      this.habitsChanged.emit();
    }
    this.editingHabitId.set(null);
    this.editingHabitName.set('');
  }

  cancelEdit() {
    this.editingHabitId.set(null);
    this.editingHabitName.set('');
  }

  openDeleteModal(habit: Habit) {
    this.habitToDelete.set(habit);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.habitToDelete.set(null);
    this.showDeleteModal.set(false);
  }

  async confirmDeleteHabit() {
    const habit = this.habitToDelete();
    if (habit?.id) {
      await this.db.deleteHabit(habit.id);
      this.habitsChanged.emit();
    }
    this.closeDeleteModal();
  }

  previousMonth() {
    const currentMonth = this.selectedMonth();
    const currentYear = this.selectedYear();
    
    if (currentMonth === 0) {
      this.selectedMonth.set(11);
      this.selectedYear.set(currentYear - 1);
    } else {
      this.selectedMonth.set(currentMonth - 1);
    }
  }

  nextMonth() {
    const currentMonth = this.selectedMonth();
    const currentYear = this.selectedYear();
    
    if (currentMonth === 11) {
      this.selectedMonth.set(0);
      this.selectedYear.set(currentYear + 1);
    } else {
      this.selectedMonth.set(currentMonth + 1);
    }
  }

  goToCurrentMonth() {
    this.selectedYear.set(this.currentYear);
    this.selectedMonth.set(this.currentMonth);
  }
}
