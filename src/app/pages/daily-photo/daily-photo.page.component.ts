import { Component, inject, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { ImagesService, ImageMetadata } from '../../services/images.service';
import { WeatherService, WeatherData } from '../../services/weather.service';

@Component({
  selector: 'app-daily-photo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-photo.page.component.html',
})
export class DailyPhotoComponent {
  // Inject services
  private authService = inject(AuthService);
  private storageService = inject(StorageService);
  private imagesService = inject(ImagesService);
  private weatherService = inject(WeatherService);

  constructor() {
    effect(() => {
      const currentUser = this.user();
      console.log('User state changed:', currentUser?.email || 'Not logged in');

      if (currentUser && !this.weatherFetched()) {
        this.weatherFetched.set(true);
        this.getWeather();
      } else if (!currentUser) {
        this.weatherFetched.set(false);
        this.weatherData.set(null);
      }
    });
  }

  // worker that performs detection
  private currentWorker: Worker | null = null;

  resultSrc = signal<string | null>(null);
  processing = signal(false);

  // Expose user signal for template
  readonly user = this.authService.user;

  // Track upload progress
  uploadProgress = signal<number | undefined>(undefined);
  uploadState = signal<string>('');

  // Photo preview
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  // User's images - automatically loads when user logs in
  readonly images = this.imagesService.getUserImagesSignal();

  // Weather data
  weatherData = signal<WeatherData | null>(null);
  loadingWeather = signal(false);
  weatherFetched = signal(false);

  // Track which images are being deleted
  deletingImages = signal<Set<string>>(new Set());

  // Track which images are being edited (imageId -> edited name)
  editingImages = signal<Map<string, string>>(new Map());

  // Weather logic
  async getWeather(): Promise<void> {
    if (this.loadingWeather()) return;

    this.loadingWeather.set(true);
    try {
      const location = await this.weatherService.getCurrentLocation();
      const weather = await this.weatherService.getWeather(location.lat, location.lon).toPromise();
      if (weather) {
        this.weatherData.set(weather);
      }
    } catch (e) {
      console.error('Error fetching weather:', e);
    } finally {
      this.loadingWeather.set(false);
    }
  }

  // 2. Photo Selection & Preview
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Remove previous preview if exists
    this.removePreview();

    // Store file and create preview
    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);

    // Reset upload state
    this.uploadState.set('');
    this.uploadProgress.set(undefined);

    // Reset file input so same file can be selected again
    event.target.value = '';
  }

  removePreview() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.selectedFile = null;
    this.uploadState.set('');
    this.uploadProgress.set(undefined);
  }

  async removeBackground(): Promise<void> {
    console.log(this.selectedFile);
    if (!this.selectedFile) return;
    await this.processFile(this.selectedFile);
  }

  private revokeUrl(url: string | null) {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }

  async processFile(file: Blob | File) {
    console.log('process');
    // stop and cleanup previous worker if any
    this.cleanupWorker();

    // create worker and wire messages
    try {
      this.currentWorker = new Worker(
        new URL('../../services/bg-remove.worker.js', import.meta.url),
        {
          type: 'module',
        },
      );

      console.log('Worker created successfully:', this.currentWorker);
    } catch (workerError) {
      console.error('Failed to create worker:', workerError);
      return;
    }

    this.currentWorker.onmessage = (ev: MessageEvent) => {
      console.log('Main thread received message:', ev.data);
      const data = ev.data;
      if (data?.type === 'progress') {
        //this.progress.set(data.progress);
      } else if (data?.type === 'result') {
        console.log('Finished');
        const blob: Blob = data.blob;
        const url = URL.createObjectURL(blob);
        this.revokeUrl(this.resultSrc());
        this.previewUrl = url;
        this.cleanupWorker();
        this.processing.set(false);
        //this.progress.set(null);
      } else if (data?.type === 'started') {
        console.log('Starting');
        // starting
      } else if (data?.type === 'error') {
        console.log('Processing error');
        //this.error.set(data.error || 'Unknown error');
        this.cleanupWorker();
        // ensure timer is stopped on error
        this.processing.set(false);
      }
    };

    this.currentWorker.onerror = (error) => {
      console.error('Worker error details:', {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        error: error.error,
      });
      console.error('Full worker error object:', error);
    };

    // transfer the image data to avoid cloning overhead
    try {
      const buffer = await (file as File).arrayBuffer();
      // send single message asking the worker to run both preview and final
      console.log('run');
      this.currentWorker.postMessage(
        {
          buffer,
          type: (file as File).type || 'image/png',
          maxWidthFinal: 512,
        },
        [buffer],
      );
      console.log('post message');
    } catch (err: any) {
      // fallback: if reading fails, send the file directly (structured clone)
      this.currentWorker.postMessage({
        file,
        type: (file as File).type || 'image/png',
        maxWidthFinal: 512,
      } as any);
    }
  }

  private cleanupWorker() {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.currentWorker = null;
    }
  }
  // 3. Upload Logic
  async uploadFile(): Promise<void> {
    if (!this.selectedFile) return;

    const currentUser = this.user();
    if (!currentUser) {
      this.uploadState.set('Error: User not authenticated');
      return;
    }

    try {
      // Generate secure file path
      const filePath = this.storageService.getUserUploadPath(
        currentUser.uid,
        this.selectedFile.name,
      );

      // Upload file with progress tracking
      const downloadURL = await this.storageService.uploadFile(
        this.selectedFile,
        filePath,
        (progress) => {
          this.uploadProgress.set(progress);
        },
      );

      // Create image metadata in Firestore
      await this.imagesService.createImage({
        name: this.selectedFile.name,
        imageUrl: downloadURL,
        userId: currentUser.uid,
      });

      this.uploadState.set('Upload Complete!');

      // Clear preview after successful upload
      // Images list will automatically refresh via the signal
      this.removePreview();
    } catch (err: any) {
      this.uploadState.set('Error: ' + err.message);
      this.uploadProgress.set(undefined);
    }
  }

  // 4. Delete Logic
  async deleteImage(image: ImageMetadata): Promise<void> {
    if (!image.id) {
      this.uploadState.set('Error: Image ID not found');
      return;
    }

    const currentUser = this.user();
    if (!currentUser) {
      this.uploadState.set('Error: User not authenticated');
      return;
    }

    // Verify the image belongs to the current user
    if (image.userId !== currentUser.uid) {
      this.uploadState.set('Error: Unauthorized to delete this image');
      return;
    }

    // Add to deleting set
    this.deletingImages.update((set) => new Set(set).add(image.id!));

    try {
      // Delete file from Storage using the URL (which contains the original path)
      // This works even if the name was edited in Firestore
      await this.storageService.deleteFileByUrl(image.imageUrl);

      // Delete document from Firestore
      await this.imagesService.deleteImage(image.id);

      // Images list will automatically refresh via the signal
      this.uploadState.set('Image deleted successfully');

      // Clear message after a short delay
      setTimeout(() => {
        this.uploadState.set('');
      }, 2000);
    } catch (err: any) {
      this.uploadState.set('Error deleting image: ' + err.message);
    } finally {
      // Remove from deleting set
      this.deletingImages.update((set) => {
        const newSet = new Set(set);
        newSet.delete(image.id!);
        return newSet;
      });
    }
  }

  // Helper to check if an image is being deleted
  isDeleting(imageId: string | undefined): boolean {
    if (!imageId) return false;
    return this.deletingImages().has(imageId);
  }

  // 5. Edit Logic
  startEditing(image: ImageMetadata): void {
    if (!image.id) return;
    this.editingImages.update((map) => {
      const newMap = new Map(map);
      newMap.set(image.id!, image.name);
      return newMap;
    });
  }

  cancelEditing(imageId: string | undefined): void {
    if (!imageId) return;
    this.editingImages.update((map) => {
      const newMap = new Map(map);
      newMap.delete(imageId);
      return newMap;
    });
  }

  updateEditingName(imageId: string, newName: string): void {
    this.editingImages.update((map) => {
      const newMap = new Map(map);
      newMap.set(imageId, newName);
      return newMap;
    });
  }

  getEditingName(imageId: string | undefined): string {
    if (!imageId) return '';
    return this.editingImages().get(imageId) || '';
  }

  isEditing(imageId: string | undefined): boolean {
    if (!imageId) return false;
    return this.editingImages().has(imageId);
  }

  async saveImageName(image: ImageMetadata): Promise<void> {
    if (!image.id) {
      this.uploadState.set('Error: Image ID not found');
      return;
    }

    const currentUser = this.user();
    if (!currentUser) {
      this.uploadState.set('Error: User not authenticated');
      return;
    }

    // Verify the image belongs to the current user
    if (image.userId !== currentUser.uid) {
      this.uploadState.set('Error: Unauthorized to edit this image');
      return;
    }

    const editedName = this.getEditingName(image.id);
    if (!editedName || editedName.trim() === '') {
      this.uploadState.set('Error: Name cannot be empty');
      this.cancelEditing(image.id);
      return;
    }

    // If name hasn't changed, just cancel editing
    if (editedName === image.name) {
      this.cancelEditing(image.id);
      return;
    }

    try {
      await this.imagesService.updateImage(image.id, {
        name: editedName.trim(),
      });

      // Images list will automatically refresh via the signal
      this.uploadState.set('Name updated successfully');

      // Clear message after a short delay
      setTimeout(() => {
        this.uploadState.set('');
      }, 2000);

      // Cancel editing
      this.cancelEditing(image.id);
    } catch (err: any) {
      this.uploadState.set('Error updating name: ' + err.message);
    }
  }
}
