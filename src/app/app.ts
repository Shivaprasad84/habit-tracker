import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitTrackerComponent } from './components/habit-tracker/habit-tracker.component';
import { SidebarComponent, ViewType } from './components/sidebar/sidebar.component';
import { HabitsListComponent } from './components/habits-list/habits-list.component';
import { StatsComponent } from './components/stats/stats.component';
import { AddHabitModalComponent } from './components/add-habit-modal/add-habit-modal.component';
import { DatabaseService } from './services/database.service';
import { Habit } from './models/habit.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HabitTrackerComponent,
    SidebarComponent,
    HabitsListComponent,
    StatsComponent,
    AddHabitModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  activeView = signal<ViewType>('dashboard');
  showAddModal = signal(false);
  habits = signal<Habit[]>([]);

  constructor(private db: DatabaseService) {
    this.loadHabits();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    const activeElement = document.activeElement;
    const isInputFocused = activeElement instanceof HTMLInputElement ||
                           activeElement instanceof HTMLTextAreaElement ||
                           activeElement?.hasAttribute('contenteditable');
    
    if (event.key === 'n' && !isInputFocused && !this.showAddModal()) {
      event.preventDefault();
      this.openAddModal();
    }
  }

  async loadHabits(): Promise<void> {
    const habits = await this.db.getAllHabits();
    this.habits.set(habits);
  }

  onViewChange(view: ViewType): void {
    this.activeView.set(view);
  }

  openAddModal(): void {
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  async addHabit(name: string): Promise<void> {
    await this.db.addHabit(name);
    await this.loadHabits();
    this.closeAddModal();
  }

  async updateHabit(event: { id: number; name: string }): Promise<void> {
    await this.db.updateHabit(event.id, event.name);
    await this.loadHabits();
  }

  async deleteHabit(habitId: number): Promise<void> {
    await this.db.deleteHabit(habitId);
    await this.loadHabits();
  }
}
