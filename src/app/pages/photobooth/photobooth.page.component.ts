import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

@Component({
  selector: 'app-photobooth',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photobooth.page.component.html',
  styleUrls: ['./photobooth.page.component.scss'],
})
export class PhotoBoothPageComponent {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('output', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private segmenter!: ImageSegmenter;

  async ngOnInit() {
    // 1) Inicia webcam
    const video = this.videoRef.nativeElement;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    console.log(video);
    await new Promise((res) => (video.onloadeddata = () => res(true)));

    // 2) Carrega els fitxers WASM/JS de MediaPipe Tasks
    const visionFileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    // 3) Crea l'ImageSegmenter (model per segmentar persones/selfie)
    this.segmenter = await ImageSegmenter.createFromOptions(visionFileset, {
      baseOptions: {
        modelAssetPath: 'mediapipe.tflite',
      },
      runningMode: 'VIDEO', // important per a vídeo en temps real
    });

    // 4) Comença el loop
    this.startLoop();
  }

  private startLoop() {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const render = async () => {
      if (video.readyState >= 2 && this.segmenter) {
        // segmentForVideo accepta el vídeo i un timestamp (performance.now())
        const result = await this.segmenter.segmentForVideo(video, performance.now());

        // result pot tenir diferents formes depenent de la versió; intentem trobar la màscara
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // dibuixem la màscara i usem compositing per aplicar-la al vídeo
        ctx.save();

        // intentar trobar la màscara en diverses propietats conegudes
        const mask =
          (result as any).mask ??
          (result as any).segmentation ??
          (result as any).segmentationMask ??
          (result as any).categoryMask ??
          null;

        if (mask) {
          // primer posem la màscara a canvas (copiar)
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(mask as CanvasImageSource, 0, 0, canvas.width, canvas.height);

          // després fem que només es mostri la part de la persona
          ctx.globalCompositeOperation = 'source-in';
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
      }

      requestAnimationFrame(render);
    };

    render();
  }
}
