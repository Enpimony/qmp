import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Item, Section } from 'src/app/pages/photobooth/photobooth.page.component';

interface ExtendedItem extends Item {
  img: string;
}

@Component({
  selector: 'app-photobooth-section-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photobooth-section-item.html',
  styleUrls: ['./photobooth-section-item.css'],
})
export class PhotoboothSectionItemComponent {
  readonly section = input<Section>();
  readonly item = input<Item>();

  extendedItem = computed(() => {
    // Add any cleaning or processing logic here if needed
    const item = this.item();
    const section = this.section();
    if (!item || !section) {
      // Return a default extended item if inputs are not ready yet
      return { ...((item ?? { name: '' }) as Item), img: '' } as ExtendedItem;
    }
    const extended = { ...item, img: `assets/${section.id}/${item.id}.png` } as ExtendedItem;
    return extended;
  });
}
