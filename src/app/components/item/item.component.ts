import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-item-group',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="flex flex-col gap-1.5"><ng-content></ng-content></div>',
})
export class ItemGroupComponent {}

@Component({
  selector: 'app-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      [class]="getItemClasses()"
    >
      <ng-content></ng-content>
    </div>
  `,
})
export class ItemComponent {
  @Input() variant: 'default' | 'outline' | 'muted' = 'default';
  @Input() size: 'default' | 'sm' = 'default';

  getItemClasses(): string {
    const baseClasses = 'flex items-start gap-3 rounded-md transition-colors';
    
    const variantClasses = {
      default: 'bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground',
      outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
      muted: 'bg-muted text-muted-foreground hover:bg-muted/80'
    };
    
    const sizeClasses = {
      default: 'p-3',
      sm: 'p-2'
    };
    
    return `${baseClasses} ${variantClasses[this.variant]} ${sizeClasses[this.size]}`;
  }
}

@Component({
  selector: 'app-item-content',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="flex flex-1 flex-col gap-1.5 overflow-hidden"><ng-content></ng-content></div>',
})
export class ItemContentComponent {}

@Component({
  selector: 'app-item-title',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="text-sm font-medium leading-none truncate"><ng-content></ng-content></div>',
})
export class ItemTitleComponent {}

@Component({
  selector: 'app-item-description',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="text-sm text-muted-foreground break-words"><ng-content></ng-content></div>',
})
export class ItemDescriptionComponent {}

@Component({
  selector: 'app-item-actions',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="flex items-center gap-2"><ng-content></ng-content></div>',
})
export class ItemActionsComponent {}

@Component({
  selector: 'app-item-media',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="getMediaClasses()">
      <ng-content></ng-content>
    </div>
  `,
})
export class ItemMediaComponent {
  @Input() variant: 'default' | 'icon' | 'image' = 'default';

  getMediaClasses(): string {
    if (this.variant === 'icon') {
      return 'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted';
    }
    return 'flex shrink-0';
  }
}

