import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-radio-group',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      [class]="getContainerClasses()"
      role="radiogroup"
    >
      <ng-content></ng-content>
    </div>
  `,
})
export class RadioGroupComponent {
  @Input() orientation: 'horizontal' | 'vertical' = 'vertical';

  getContainerClasses(): string {
    const baseClasses = 'grid gap-2';
    const orientationClasses = this.orientation === 'vertical' ? 'grid-cols-1' : 'grid-cols-2';
    return `${baseClasses} ${orientationClasses}`;
  }
}
