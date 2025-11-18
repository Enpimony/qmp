import { Component, ElementRef, effect, inject, output, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColorThiefModule, ColorThiefService } from '@soarlin/angular-color-thief';
import { ColorResult } from './color-result';

@Component({
  selector: 'app-photo-manager',
  standalone: true,
  imports: [CommonModule, ColorThiefModule],
  templateUrl: './photo-manager.html',
  styleUrls: ['./photo-manager.scss'],
})
export class PhotoManagerComponent {
  private selectedFile = signal<File | null>(null);
  preview = signal<string | ArrayBuffer | null>(null);
  previewLoading = signal<boolean>(false);
  colors = signal<ColorResult>({ dominant: null, palette: null });
  fileChange = output<File | null>();
  colorsChange = output<ColorResult>();
  @ViewChild('previewImage', { static: false }) imatge!: ElementRef<HTMLImageElement>;
  private colorThief = inject(ColorThiefService);

  constructor() {
    effect(() => {
      this.fileChange.emit(this.selectedFile());
    });

    effect(() => {
      this.colorsChange.emit(this.colors());
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    this.selectedFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.previewLoading.set(false);
      this.preview.set(reader.result);
    };
    this.previewLoading.set(true);
    reader.readAsDataURL(file);
  }

  takePhoto() {
    console.log('takePhoto clicked');
  }

  async getColors() {
    this.colors.set({
      dominant: this.colorThief.getColor(this.imatge.nativeElement),
      palette: this.colorThief.getPalette(this.imatge.nativeElement),
    });
  }
}
