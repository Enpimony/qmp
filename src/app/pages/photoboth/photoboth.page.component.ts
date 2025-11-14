import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

@Component({
  selector: 'app-photobooth',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photoboth.page.component.html',
  styleUrls: ['./photoboth.page.component.scss'],
})
export class PhotoBoothPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('output', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private segmenter?: ImageSegmenter;
  private animationId = 0;

  async ngAfterViewInit() {
    const video = this.videoRef.nativeElement;

    // Start webcam
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    // Ensure canvas matches video size
    const canvas = this.canvasRef.nativeElement;
    const setCanvasSize = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };
    setCanvasSize();
    video.addEventListener('loadedmetadata', setCanvasSize);

    // Load MediaPipe Tasks vision fileset (WASM)
    const visionFileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    // Create the ImageSegmenter for selfie/person segmentation
    this.segmenter = await ImageSegmenter.createFromOptions(visionFileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie/float16/1/model.tflite',
      },
      // Use the library's expected string literal for video mode
      runningMode: 'VIDEO',
    });

    this.startLoop();
  }

  private startLoop() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const render = async () => {
      if (video.readyState >= 2 && this.segmenter) {
        try {
          const result = await this.segmenter.segmentForVideo(video, performance.now());

          // result may expose the mask under different property names depending on version
          const mask =
            (result as any).mask ??
            (result as any).segmentation ??
            (result as any).segmentationMask ??
            (result as any).categoryMask ??
            null;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (mask) {
            ctx.save();
            // draw the mask first
            ctx.globalCompositeOperation = 'copy';
            ctx.drawImage(mask as CanvasImageSource, 0, 0, canvas.width, canvas.height);

            // use mask to show only the person
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } else {
            // fallback: draw the raw video so you can see output while debugging
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } catch (err) {
          console.error('Segmentation error:', err);
          // on error draw video as fallback
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    // stop webcam tracks
    const video = this.videoRef?.nativeElement;
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    this.segmenter?.close();
  }
}
