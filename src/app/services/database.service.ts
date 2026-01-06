import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Habit, HabitCompletion } from '../models/habit.model';

@Injectable({
  providedIn: 'root',
})
export class DatabaseService extends Dexie {
  habits!: Table<Habit, number>;
  completions!: Table<HabitCompletion, number>;

  constructor() {
    super('HabitTrackerDB');
    
    this.version(2).stores({
      habits: '++id, name, createdAt',
      completions: '++id, habitId, [habitId+year+month], [habitId+year+month+day]',
    });
  }

  async getAllHabits(): Promise<Habit[]> {
    return await this.habits.orderBy('createdAt').toArray();
  }

  async addHabit(name: string): Promise<number> {
    return await this.habits.add({
      name,
      createdAt: new Date(),
    });
  }

  async updateHabit(id: number, name: string): Promise<void> {
    await this.habits.update(id, { name });
  }

  async deleteHabit(id: number): Promise<void> {
    await this.habits.delete(id);
    await this.completions.where('habitId').equals(id).delete();
  }

  async getCompletions(
    habitId: number,
    year: number,
    month: number
  ): Promise<HabitCompletion[]> {
    return await this.completions
      .where(['habitId', 'year', 'month'])
      .equals([habitId, year, month])
      .toArray();
  }

  async toggleCompletion(
    habitId: number,
    year: number,
    month: number,
    day: number
  ): Promise<void> {
    const existing = await this.completions
      .where(['habitId', 'year', 'month', 'day'])
      .equals([habitId, year, month, day])
      .first();

    if (existing) {
      await this.completions.update(existing.id!, {
        completed: !existing.completed,
      });
    } else {
      await this.completions.add({
        habitId,
        year,
        month,
        day,
        completed: true,
      });
    }
  }

  async getCompletion(
    habitId: number,
    year: number,
    month: number,
    day: number
  ): Promise<boolean> {
    const completion = await this.completions
      .where(['habitId', 'year', 'month', 'day'])
      .equals([habitId, year, month, day])
      .first();

    return completion?.completed || false;
  }

  async getAllCompletionsForHabit(habitId: number): Promise<HabitCompletion[]> {
    return await this.completions.where('habitId').equals(habitId).toArray();
  }

  async exportData(): Promise<void> {
    const habits = await this.habits.toArray();
    const completions = await this.completions.toArray();

    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      habits,
      completions,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async importData(
    file: File
  ): Promise<{ habits: number; completions: number }> {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.habits || !data.completions) {
      throw new Error('Invalid backup file format');
    }

    await this.habits.clear();
    await this.completions.clear();

    const idMap = new Map<number, number>();

    for (const habit of data.habits) {
      const oldId = habit.id;
      delete habit.id;
      habit.createdAt = new Date(habit.createdAt);
      const newId = await this.habits.add(habit);
      idMap.set(oldId, newId);
    }

    for (const completion of data.completions) {
      delete completion.id;
      completion.habitId = idMap.get(completion.habitId) ?? completion.habitId;
      await this.completions.add(completion);
    }

    return { habits: data.habits.length, completions: data.completions.length };
  }
}
