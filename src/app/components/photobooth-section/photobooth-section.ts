import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Section } from 'src/app/pages/photobooth/photobooth.page.component';

interface ExtendedSectin extends Section {
  img: string;
}

@Component({
  selector: 'app-photobooth-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photobooth-section.html',
  styleUrls: ['./photobooth-section.scss'],
})
export class PhotoboothSectionComponent {
  readonly section = input<any>();

  extendedSection = computed(() => {
    // Add any cleaning or processing logic here if needed
    const section = this.section();
    const extended = section as ExtendedSectin;
    extended.img = `assets/wear-${section.id}.png`;
    return extended;
  });
}
