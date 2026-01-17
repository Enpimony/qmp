import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { removeBackground, preload, Config } from '@imgly/background-removal';

@Component({
  selector: 'page-remove-bg',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './remove-bg.page.html',
})
export class RemoveBgPage implements OnDestroy {
  originalSrc = signal<string | null>(null);
  resultSrc = signal<string | null>(null);
  processing = signal(false);
  progress = signal<number | null>(null);
  error = signal<string | null>(null);

  // indicate if current result is the quick preview (low-res)
  isPreview = signal(false);

  // track elapsed seconds during detection
  elapsed = signal(0);
  private timerId: number | null = null;

  // worker that performs detection
  private currentWorker: Worker | null = null;

  private startTimer() {
    // don't restart if already running
    if (this.timerId !== null) return;
    this.elapsed.set(0);
    this.timerId = window.setInterval(() => {
      this.elapsed.set(this.elapsed() + 1);
    }, 1000);
  }

  private stopTimer() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
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

  private async scaleImageFile(file: Blob | File, maxWidth = 512): Promise<Blob> {
    try {
      const imgBitmap = await createImageBitmap(file);
      if (imgBitmap.width <= maxWidth) {
        imgBitmap.close?.();
        return file; // no scaling needed
      }

      const scale = maxWidth / imgBitmap.width;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(imgBitmap.width * scale);
      canvas.height = Math.round(imgBitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        imgBitmap.close?.();
        return file;
      }
      ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
      imgBitmap.close?.();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, (file as File).type || 'image/png')
      );
      return blob ?? file;
    } catch (e) {
      // If any error occurs, fallback to original file
      return file;
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    this.error.set(null);
    this.revokeUrl(this.originalSrc());
    // scale for display (small) - keep this for the original preview shown to user
    const scaledForDisplay = await this.scaleImageFile(file, 512);
    const url = URL.createObjectURL(scaledForDisplay);
    this.originalSrc.set(url);
    // pass original file so worker can re-scale/transfer as needed
    this.processFile(file);
  }

  cancelProcessing() {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.currentWorker = null;
      this.processing.set(false);
      this.progress.set(null);
      this.error.set('Cancelled');
      this.stopTimer();
    }
  }

  async processFile(file: Blob | File) {
    this.processing.set(true);
    this.progress.set(0);
    this.revokeUrl(this.resultSrc());
    this.resultSrc.set(null);
    this.isPreview.set(false);
    this.error.set(null);

    // stop and cleanup previous worker if any
    this.cleanupWorker();

    // create worker and wire messages
    this.currentWorker = new Worker(new URL('./remove-bg.worker', import.meta.url), {
      type: 'module',
    });
    this.currentWorker.onmessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (data?.type === 'progress') {
        this.progress.set(data.progress);
      } else if (data?.type === 'preview') {
        // show quick (low-res) result immediately
        const blob: Blob = data.blob;
        const url = URL.createObjectURL(blob);
        // revoke old result url if any
        this.revokeUrl(this.resultSrc());
        this.resultSrc.set(url);
        this.isPreview.set(true);
      } else if (data?.type === 'result') {
        // final high-res result
        const blob: Blob = data.blob;
        const url = URL.createObjectURL(blob);
        this.revokeUrl(this.resultSrc());
        this.resultSrc.set(url);
        this.isPreview.set(false);
        this.cleanupWorker();
        // stop timer when done
        this.stopTimer();
        this.processing.set(false);
        this.progress.set(null);
      } else if (data?.type === 'started') {
        this.startTimer();
      } else if (data?.type === 'error') {
        console.log(data.error);
        this.error.set(data.error || 'Unknown error');
        this.cleanupWorker();
        // ensure timer is stopped on error
        this.stopTimer();
        this.processing.set(false);
        this.progress.set(null);
      }
    };

    // transfer the image data to avoid cloning overhead
    try {
      const buffer = await (file as File).arrayBuffer();
      // send single message asking the worker to run both preview and final
      this.currentWorker.postMessage(
        {
          buffer,
          type: (file as File).type || 'image/png',
          maxWidthPreview: 256,
          maxWidthFinal: 512,
        },
        [buffer]
      );
    } catch (err: any) {
      // fallback: if reading fails, send the file directly (structured clone)
      this.currentWorker.postMessage({
        file,
        type: (file as File).type || 'image/png',
        maxWidthPreview: 256,
        maxWidthFinal: 512,
      } as any);
    }
  }

  private cleanupWorker() {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.currentWorker = null;
    }
    // ensure timer is stopped when worker is cleaned up
    this.stopTimer();
  }

  ngOnDestroy(): void {
    this.cleanupWorker();
    this.stopTimer();
  }
}
