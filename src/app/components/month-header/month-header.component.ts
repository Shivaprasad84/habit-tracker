import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-month-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month-header.component.html',
})
export class MonthHeaderComponent {
  @Input() currentYear!: number;
  @Input() currentMonth!: number;
  @Input() selectedYear!: number;
  @Input() selectedMonth!: number;

  getDaysInMonth(): number[] {
    const daysCount = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }

  isToday(day: number): boolean {
    return (
      day === new Date().getDate() &&
      this.selectedMonth === this.currentMonth &&
      this.selectedYear === this.currentYear
    );
  }
}
