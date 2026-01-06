import { Component, Input, computed, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Habit, HabitCompletion } from '../../models/habit.model';
import { DatabaseService } from '../../services/database.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface HabitStats {
  habitId: number;
  habitName: string;
  currentStreak: number;
  bestStreak: number;
  bestStreakStartDate: Date | null;
  totalCompletions: number;
  monthlyCompletions: number;
  yearlyConsistency: number;
  monthlyConsistency: number;
  daysSinceCreation: number;
}

interface MonthlyBreakdown {
  [habitName: string]: number;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
})
export class StatsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('monthlyChart') monthlyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('consistencyChart') consistencyChartRef!: ElementRef<HTMLCanvasElement>;

  private monthlyChart?: Chart;
  private consistencyChart?: Chart;
  private chartsInitialized = false;

  // Year navigation for Activity Overview
  selectedYear = signal(new Date().getFullYear());
  
  // Month navigation for Consistency chart
  selectedMonth = signal(new Date().getMonth());
  selectedMonthYear = signal(new Date().getFullYear());
  
  readonly monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];

  @Input() set habits(value: Habit[]) {
    this._habits.set(value);
    this.loadStats();
  }

  private _habits = signal<Habit[]>([]);
  monthlyData = signal<{ month: string; breakdown: MonthlyBreakdown }[]>([]);
  habitStats = signal<HabitStats[]>([]);
  isLoading = signal(true);

  bestOverallStreak = computed(() => {
    const stats = this.habitStats();
    if (stats.length === 0) return null;
    return stats.reduce((best, current) => 
      current.bestStreak > best.bestStreak ? current : best
    );
  });

  mostCompletedThisMonth = computed(() => {
    const stats = this.habitStats();
    if (stats.length === 0) return null;
    return stats.reduce((best, current) => 
      current.monthlyCompletions > best.monthlyCompletions ? current : best
    );
  });

  mostCompletedOverall = computed(() => {
    const stats = this.habitStats();
    if (stats.length === 0) return null;
    return stats.reduce((best, current) => 
      current.totalCompletions > best.totalCompletions ? current : best
    );
  });

  totalCompletionsThisYear = computed(() => {
    return this.habitStats().reduce((sum, stat) => sum + stat.totalCompletions, 0);
  });

  selectedMonthName = computed(() => this.monthNames[this.selectedMonth()]);

  constructor(private db: DatabaseService) {}

  formatBestStreakDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  ngAfterViewInit(): void {
    this.chartsInitialized = true;
    this.updateCharts();
  }

  ngOnDestroy(): void {
    this.monthlyChart?.destroy();
    this.consistencyChart?.destroy();
  }

  // Year navigation methods for Activity Overview
  previousYear(): void {
    this.selectedYear.update(y => y - 1);
    this.refreshActivityChart();
  }

  nextYear(): void {
    this.selectedYear.update(y => y + 1);
    this.refreshActivityChart();
  }

  private async refreshActivityChart(): Promise<void> {
    await this.calculateMonthlyBreakdown(this.selectedYear());
    this.createMonthlyChart();
  }

  // Month navigation methods for Consistency chart
  previousMonth(): void {
    if (this.selectedMonth() === 0) {
      this.selectedMonth.set(11);
      this.selectedMonthYear.update(y => y - 1);
    } else {
      this.selectedMonth.update(m => m - 1);
    }
    this.refreshConsistencyChart();
  }

  nextMonth(): void {
    if (this.selectedMonth() === 11) {
      this.selectedMonth.set(0);
      this.selectedMonthYear.update(y => y + 1);
    } else {
      this.selectedMonth.update(m => m + 1);
    }
    this.refreshConsistencyChart();
  }

  private async refreshConsistencyChart(): Promise<void> {
    await this.loadConsistencyStats();
    this.createConsistencyChart();
  }

  private async loadConsistencyStats(): Promise<void> {
    const habits = this._habits();
    const stats: HabitStats[] = [];
    const selectedYear = this.selectedMonthYear();
    const selectedMonth = this.selectedMonth();

    // Reference date for the selected month
    const now = new Date();
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const daysElapsedInMonth = isCurrentMonth ? now.getDate() : daysInMonth;

    for (const habit of habits) {
      if (!habit.id) continue;

      const allCompletions: HabitCompletion[] = await this.db.getAllCompletionsForHabit(habit.id);
      const completedDates = allCompletions
        .filter((c: HabitCompletion) => c.completed)
        .map((c: HabitCompletion) => new Date(c.year, c.month, c.day))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      const monthlyCompletions = allCompletions.filter(
        (c: HabitCompletion) => c.completed && c.year === selectedYear && c.month === selectedMonth
      ).length;

      const yearlyCompletions = allCompletions.filter(
        (c: HabitCompletion) => c.completed && c.year === selectedYear
      ).length;

      const { currentStreak, bestStreak, bestStreakStartDate } = this.calculateStreaks(completedDates);

      const createdAt = new Date(habit.createdAt);
      const daysSinceCreation = Math.max(1, Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Calculate consistency for the selected month
      const monthlyDates = allCompletions
        .filter((c: HabitCompletion) => c.completed && c.year === selectedYear && c.month === selectedMonth)
        .map((c: HabitCompletion) => new Date(c.year, c.month, c.day))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      const referenceDate = isCurrentMonth ? now : new Date(selectedYear, selectedMonth, daysInMonth);
      const monthlyConsistency = this.calculateMonthlyConsistency(
        monthlyCompletions,
        daysElapsedInMonth,
        monthlyDates,
        referenceDate
      );

      stats.push({
        habitId: habit.id,
        habitName: habit.name,
        currentStreak,
        bestStreak,
        bestStreakStartDate,
        totalCompletions: yearlyCompletions,
        monthlyCompletions,
        yearlyConsistency: 0,
        monthlyConsistency,
        daysSinceCreation,
      });
    }

    this.habitStats.set(stats);
  }

  async loadStats(): Promise<void> {
    this.isLoading.set(true);
    const habits = this._habits();
    const stats: HabitStats[] = [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (const habit of habits) {
      if (!habit.id) continue;

      const allCompletions: HabitCompletion[] = await this.db.getAllCompletionsForHabit(habit.id);
      const completedDates = allCompletions
        .filter((c: HabitCompletion) => c.completed)
        .map((c: HabitCompletion) => new Date(c.year, c.month, c.day))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      const monthlyCompletions = allCompletions.filter(
        (c: HabitCompletion) => c.completed && c.year === currentYear && c.month === currentMonth
      ).length;

      const yearlyCompletions = allCompletions.filter(
        (c: HabitCompletion) => c.completed && c.year === currentYear
      ).length;

      const { currentStreak, bestStreak, bestStreakStartDate } = this.calculateStreaks(completedDates);

      // Calculate consistency percentages
      const createdAt = new Date(habit.createdAt);
      const daysSinceCreation = Math.max(1, Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Yearly consistency: completions this year / days elapsed in year (from Jan 1 or habit creation)
      const startOfYear = new Date(currentYear, 0, 1);
      const yearTrackingStart = createdAt > startOfYear ? createdAt : startOfYear;
      const daysElapsedInYear = Math.max(1, Math.floor(
        (now.getTime() - yearTrackingStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1);
      const yearlyConsistency = Math.min(100, Math.round((yearlyCompletions / daysElapsedInYear) * 100));

      // Monthly consistency: smarter calculation considering streaks and gaps
      // Always use actual days elapsed in current month (from 1st to today)
      const daysElapsedInMonth = now.getDate(); // Simply the current day of the month
      
      // Get this month's completed dates for streak/gap analysis
      const monthlyDates = allCompletions
        .filter((c: HabitCompletion) => c.completed && c.year === currentYear && c.month === currentMonth)
        .map((c: HabitCompletion) => new Date(c.year, c.month, c.day))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
      
      const monthlyConsistency = this.calculateMonthlyConsistency(
        monthlyCompletions, 
        daysElapsedInMonth, 
        monthlyDates,
        now
      );

      stats.push({
        habitId: habit.id,
        habitName: habit.name,
        currentStreak,
        bestStreak,
        bestStreakStartDate,
        totalCompletions: yearlyCompletions,
        monthlyCompletions,
        yearlyConsistency,
        monthlyConsistency,
        daysSinceCreation,
      });
    }

    // Calculate monthly breakdown for the current year
    await this.calculateMonthlyBreakdown(currentYear);

    this.habitStats.set(stats);
    this.isLoading.set(false);
    // Use setTimeout to allow Angular to render the canvas elements after isLoading becomes false
    setTimeout(() => this.updateCharts(), 0);
  }

  private async calculateMonthlyBreakdown(year: number): Promise<void> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData: { month: string; breakdown: MonthlyBreakdown }[] = [];

    for (let month = 0; month < 12; month++) {
      const breakdown: MonthlyBreakdown = {};
      
      for (const habit of this._habits()) {
        if (!habit.id) continue;
        const completions = await this.db.getAllCompletionsForHabit(habit.id);
        const count = completions.filter(
          (c: HabitCompletion) => c.completed && c.year === year && c.month === month
        ).length;
        breakdown[habit.name] = count;
      }

      monthlyData.push({ month: months[month], breakdown });
    }

    this.monthlyData.set(monthlyData);
  }

  private updateCharts(): void {
    if (!this.chartsInitialized || this.isLoading()) return;

    this.createMonthlyChart();
    this.createConsistencyChart();
  }

  private createMonthlyChart(): void {
    if (!this.monthlyChartRef?.nativeElement) return;

    this.monthlyChart?.destroy();

    const data = this.monthlyData();
    const habits = this._habits();
    if (data.length === 0 || habits.length === 0) return;

    const ctx = this.monthlyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Color palette matching sage/orange theme
    const colors = [
      'rgba(234, 88, 12, 0.8)',   // orange-600
      'rgba(101, 163, 13, 0.8)',  // lime-600
      'rgba(14, 165, 233, 0.8)',  // sky-500
      'rgba(168, 85, 247, 0.8)',  // purple-500
      'rgba(236, 72, 153, 0.8)',  // pink-500
      'rgba(20, 184, 166, 0.8)',  // teal-500
      'rgba(245, 158, 11, 0.8)',  // amber-500
      'rgba(99, 102, 241, 0.8)',  // indigo-500
    ];

    const datasets = habits.map((habit, index) => ({
      label: habit.name,
      data: data.map(d => d.breakdown[habit.name] || 0),
      backgroundColor: colors[index % colors.length],
      borderRadius: 4,
    }));

    this.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
            },
          },
          title: {
            display: false,
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Completions',
            },
          },
        },
      },
    });
  }

  private createConsistencyChart(): void {
    if (!this.consistencyChartRef?.nativeElement) return;

    this.consistencyChart?.destroy();

    const stats = this.habitStats();
    if (stats.length === 0) return;

    const ctx = this.consistencyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Sort by monthly consistency ascending (lowest first - needs most work)
    const sortedStats = [...stats].sort((a, b) => a.monthlyConsistency - b.monthlyConsistency);

    // Color based on score
    const getColor = (score: number) => {
      if (score >= 70) return 'rgba(34, 197, 94, 0.8)';  // green
      if (score >= 40) return 'rgba(234, 179, 8, 0.8)';  // yellow
      return 'rgba(239, 68, 68, 0.8)';  // red
    };

    this.consistencyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedStats.map(s => s.habitName),
        datasets: [{
          label: 'Monthly Consistency',
          data: sortedStats.map(s => s.monthlyConsistency),
          backgroundColor: sortedStats.map(s => getColor(s.monthlyConsistency)),
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: false,
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                const stat = sortedStats[context.dataIndex];
                return `Completions: ${stat.monthlyCompletions}`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Score (%)',
            },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    });
  }

  private calculateStreaks(sortedDates: Date[]): { currentStreak: number; bestStreak: number; bestStreakStartDate: Date | null } {
    if (sortedDates.length === 0) {
      return { currentStreak: 0, bestStreak: 0, bestStreakStartDate: null };
    }

    let bestStreak = 0;
    let bestStreakStartDate: Date | null = null;
    let tempStreak = 1;
    let tempStreakStartDate = new Date(sortedDates[0]);
    tempStreakStartDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Calculate best streak and track start date
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      prevDate.setHours(0, 0, 0, 0);
      currDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        // Use >= to prefer the latest streak when tied
        if (tempStreak >= bestStreak) {
          bestStreak = tempStreak;
          bestStreakStartDate = new Date(tempStreakStartDate);
        }
        tempStreak = 1;
        tempStreakStartDate = new Date(currDate);
      }
    }
    // Final check for the last streak (use >= to prefer latest)
    if (tempStreak >= bestStreak) {
      bestStreak = tempStreak;
      bestStreakStartDate = new Date(tempStreakStartDate);
    }

    // Calculate current streak by working backwards from today/yesterday
    let currentStreak = 0;
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    lastDate.setHours(0, 0, 0, 0);

    // Check if the most recent completion is today or yesterday
    if (lastDate.getTime() === today.getTime() || lastDate.getTime() === yesterday.getTime()) {
      currentStreak = 1;
      
      // Count backwards from the last date
      for (let i = sortedDates.length - 2; i >= 0; i--) {
        const currDate = new Date(sortedDates[i + 1]);
        const prevDate = new Date(sortedDates[i]);
        currDate.setHours(0, 0, 0, 0);
        prevDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { currentStreak, bestStreak, bestStreakStartDate };
  }

  private calculateMonthlyConsistency(
    completions: number,
    daysElapsed: number,
    sortedDates: Date[],
    today: Date
  ): number {
    if (completions === 0) return 0;
    
    // If only 1 day has elapsed and they completed it, that's 100%
    if (daysElapsed === 1 && completions === 1) return 100;
    
    // Base completion ratio (50% weight)
    const completionRatio = completions / daysElapsed;
    
    // Calculate best streak this month (25% weight)
    let bestMonthlyStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      prevDate.setHours(0, 0, 0, 0);
      currDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        bestMonthlyStreak = Math.max(bestMonthlyStreak, tempStreak);
        tempStreak = 1;
      }
    }
    bestMonthlyStreak = Math.max(bestMonthlyStreak, tempStreak);
    
    // Streak quality: reward streaks of 4+ days (target streak = 4)
    const targetStreak = 4;
    const streakScore = Math.min(1, bestMonthlyStreak / targetStreak);
    
    // Gap penalty: calculate average gap between completions (25% weight)
    let gapScore = 1;
    if (sortedDates.length >= 2) {
      let totalGaps = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        prevDate.setHours(0, 0, 0, 0);
        currDate.setHours(0, 0, 0, 0);
        const gap = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        totalGaps += gap;
      }
      const avgGap = totalGaps / (sortedDates.length - 1);
      // Ideal gap is 1 (consecutive days), penalize larger gaps
      // avgGap of 1 = score 1, avgGap of 3+ = score ~0.33
      gapScore = Math.min(1, 1 / avgGap);
    } else if (sortedDates.length === 1 && daysElapsed > 1) {
      // Only 1 completion but multiple days elapsed - check recency
      const lastDate = new Date(sortedDates[0]);
      lastDate.setHours(0, 0, 0, 0);
      const todayNorm = new Date(today);
      todayNorm.setHours(0, 0, 0, 0);
      const daysSinceLast = Math.floor((todayNorm.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      // If last completion was today, gapScore = 1; if 3+ days ago, lower score
      gapScore = daysSinceLast === 0 ? 1 : Math.max(0.2, 1 / (daysSinceLast + 1));
    }
    
    // Weighted formula: 50% completion ratio + 25% streak quality + 25% gap score
    const consistency = (completionRatio * 0.5 + streakScore * 0.25 + gapScore * 0.25) * 100;
    
    return Math.min(100, Math.round(consistency));
  }
}
