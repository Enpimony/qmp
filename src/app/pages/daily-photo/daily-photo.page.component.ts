import { Component, inject, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { ImagesService, ImageMetadata } from '../../services/images.service';
import { MyPhotosComponent } from '../../components/my-photos/my-photos.component';
import { DailyPhotoUiService } from './daily-photo-ui.service';
import { ClothingAnalysisComponent } from '../../components/clothing-analysis/clothing-analysis.component';

@Component({
  selector: 'app-daily-photo',
  standalone: true,
  imports: [CommonModule, MyPhotosComponent, ClothingAnalysisComponent],
  templateUrl: './daily-photo.page.component.html',
})
export class DailyPhotoComponent {
  // Inject services

  private imagesService = inject(ImagesService);
  private ui = inject(DailyPhotoUiService);

  readonly userImages = this.imagesService.getUserImagesSignal();
  readonly weatherData = this.ui.weatherData;
  readonly previewUrl = this.ui.previewUrl;

  // Track upload progress
  uploadProgress = signal<number | undefined>(undefined);
  uploadState = signal<string>('');

  // Photo preview
  selectedFile: File | null = null;

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    // Remove previous preview if exists
    this.removePreviousPreview();

    // Store file and create preview
    this.selectedFile = file;
    this.ui.previewUrl.set(URL.createObjectURL(file));

    // Reset upload state
    this.uploadState.set('');
    this.uploadProgress.set(undefined);

    // Reset file input so same file can be selected again
    event.target.value = '';
  }

  removePreviousPreview() {
    this.selectedFile = null;
    this.ui.previewUrl.set(null);
    this.uploadState.set('');
    this.uploadProgress.set(undefined);
  }

  async processFile(): Promise<void> {
    if (!this.selectedFile) return;
    await this.ui.uploadFile();
    await this.ui.detectBackground(this.selectedFile);
  }
}
