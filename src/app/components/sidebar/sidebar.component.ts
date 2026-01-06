import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../../services/database.service';

export type ViewType = 'dashboard' | 'habits' | 'stats';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Input() activeView: ViewType = 'dashboard';
  @Output() viewChange = new EventEmitter<ViewType>();
  @Output() addHabit = new EventEmitter<void>();
  @Output() dataImported = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(private db: DatabaseService) {}

  navItems: { id: ViewType; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'habits', label: 'Habits' },
    { id: 'stats', label: 'Stats' },
  ];

  onViewChange(view: ViewType): void {
    this.viewChange.emit(view);
  }

  onAddHabit(): void {
    this.addHabit.emit();
  }

  async onExport(): Promise<void> {
    await this.db.exportData();
  }

  onImportClick(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await this.db.importData(file);
      alert(`Successfully imported ${result.habits} habits and ${result.completions} completions.`);
      this.dataImported.emit();
    } catch (error) {
      alert('Failed to import data. Please ensure the file is a valid backup.');
    }

    input.value = '';
  }
}
