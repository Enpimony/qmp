import { Inject, inject, Injectable, signal } from '@angular/core';
import { WeatherData, WeatherService } from '../../services/weather.service';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { ImagesService } from '../../services/images.service';

@Injectable({
  providedIn: 'root',
})
export class DailyPhotoUiService {
  private weatherService = inject(WeatherService);
  weatherData = signal<WeatherData | null>(null);

  private authService = inject(AuthService);
  readonly user = this.authService.user;

  private storageService = inject(StorageService);

  private imagesService = inject(ImagesService);

  // worker that performs detection
  currentWorker: Worker | null = null;
  selectedFile: File | null = null;
  uploadState = signal<string>('');
  uploadProgress = signal<number | undefined>(undefined);
  processing = signal(false);
  resultSrc = signal<string | null>(null);
  previewUrl = signal<string | null>(null);

  async getWeather(): Promise<void> {
    try {
      const location = await this.weatherService.getCurrentLocation();
      const weather = await this.weatherService.getWeather(location.lat, location.lon).toPromise();
      if (weather) {
        this.weatherData.set(weather);
      }
    } catch (e) {
      console.error('Error fetching weather:', e);
    } finally {
    }
  }

  async uploadFile(fileUrl?: string): Promise<void> {
    if (!this.selectedFile) return;

    const currentUser = this.user();
    if (!currentUser) return;

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
    } catch (err: any) {
      this.uploadState.set('Error: ' + err.message);
      this.uploadProgress.set(undefined);
    }
  }

  cleanupWorker() {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.currentWorker = null;
    }
  }

  revokeUrl(url: string | null) {
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }

  async detectBackground(file: Blob | File) {
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
    } catch (workerError) {
      console.error('Failed to create worker:', workerError);
      return;
    }

    this.currentWorker.onmessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (data?.type === 'progress') {
        //this.progress.set(data.progress);
      } else if (data?.type === 'result') {
        const blob: Blob = data.blob;
        const url = URL.createObjectURL(blob);
        this.revokeUrl(this.resultSrc());
        this.previewUrl.set(url);
        this.cleanupWorker();
        this.processing.set(false);
        //this.progress.set(null);
      } else if (data?.type === 'started') {
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

      this.currentWorker.postMessage(
        {
          buffer,
          type: (file as File).type || 'image/png',
          maxWidthFinal: 512,
        },
        [buffer],
      );
    } catch (err: any) {
      // fallback: if reading fails, send the file directly (structured clone)
      this.currentWorker.postMessage({
        file,
        type: (file as File).type || 'image/png',
        maxWidthFinal: 512,
      } as any);
    }
  }
}
