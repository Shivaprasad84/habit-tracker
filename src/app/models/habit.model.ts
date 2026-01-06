export interface Habit {
  id?: number;
  name: string;
  createdAt: Date;
}

export interface HabitCompletion {
  id?: number;
  habitId: number;
  year: number;
  month: number;
  day: number;
  completed: boolean;
}

export interface HabitWithCompletions {
  habit: Habit;
  completions: Map<number, boolean>;
}
