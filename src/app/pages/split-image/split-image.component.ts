import { Component, ElementRef, ViewChild } from '@angular/core';
import { YoloService, Detection } from '../../services/yolo.service';
import { CommonModule, PercentPipe } from '@angular/common';

@Component({    
  selector: 'app-split-image',
  standalone: true,
  imports: [CommonModule, PercentPipe],
  templateUrl: './split-image.component.html',
  styleUrls: ['./split-image.component.css']
})
export class SplitImageComponent {
  @ViewChild('canvasOutput', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  imageSrc: string | null = null;
  isAnalyzing = false;
  detectedItems: any[] = []; // Stores the crops and labels

  constructor(private yoloService: YoloService) {}

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isAnalyzing = true;
    this.detectedItems = []; // Reset
    
    // 1. Load Image for Display & AI
    const imgElement = await this.loadImage(file);
    this.imageSrc = imgElement.src;

    // 2. Run YOLO Detection
    // This returns: [{ label: 'skirt', box: [x, y, w, h], score: 0.8 }, ...]
    const detections = await this.yoloService.detect(imgElement);

    // 3. Process the results (Draw boxes & Crop items)
    this.drawAndCrop(imgElement, detections);

    this.isAnalyzing = false;
  }


  saveItem(item: any) {
    console.log('Saving item:', item);
  }

  // --- Visualization & Cropping Logic ---
  private async drawAndCrop(img: HTMLImageElement, detections: Detection[]) {
    // Setup Canvas to match image size
    const canvas = this.canvasRef.nativeElement;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;

    // Draw the original image first
    ctx.drawImage(img, 0, 0);

    for (const det of detections) {
      const [x, y, w, h] = det.box;

      // A. Draw Bounding Box (Visual Feedback)
      ctx.strokeStyle = '#00FF00'; // Green Box
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      
      ctx.fillStyle = '#00FF00';
      ctx.font = '18px Arial';
      ctx.fillText(`${det.label} (${Math.round(det.score * 100)}%)`, x, y > 20 ? y - 5 : y + 20);

      // B. Crop the Item (For your Database)
      const blob = await this.createCropBlob(img, det.box);
      
      this.detectedItems.push({
        label: det.label,
        confidence: det.score,
        imageUrl: URL.createObjectURL(blob), // Display the crop
        blob: blob // <--- THIS is what you send to Firebase
      });
    }
  }

  // --- Helper: Load File to Image ---
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(file);
    });
  }

  // --- Helper: Crop specific area ---
  private async createCropBlob(img: HTMLImageElement, box: [number, number, number, number]): Promise<Blob> {
    const [x, y, w, h] = box;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    
    // Draw only the cutout
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg'));
  }
}