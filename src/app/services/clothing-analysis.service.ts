import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
// Ensure TFJS backends are registered (tree-shaking can otherwise drop them)
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as mobilenet from '@tensorflow-models/mobilenet';

// COCO-SSD doesn't have explicit labels like "trousers" or "shirt".
// These are the closest clothing / outfit related classes available.
const CLOTHING_RELATED_CLASSES: ReadonlyArray<string> = [
  'person',      // treat the full person box as the outfit
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
];

export interface DetectedItem {
  blob: Blob;          // The actual cropped image file
  category: string;    // e.g., 'person', 'tie' (COCO classes are limited, but good for generic start)
  confidence: number;
  embedding: number[]; // The vector fingerprint for matching
}

@Injectable({
  providedIn: 'root'
})
export class ClothingAnalysisService {
  private detectorModel: cocoSsd.ObjectDetection | null = null;
  private embeddingModel: mobilenet.MobileNet | null = null;
  private tfReady: Promise<void> | null = null;

  private async ensureTfReady(): Promise<void> {
    if (!this.tfReady) {
      this.tfReady = (async () => {
        // Prefer WebGL for performance; fall back to CPU if unavailable.
        try {
          await tf.setBackend('webgl');
        } catch {
          await tf.setBackend('cpu');
        }
        await tf.ready();
      })();
    }
    return this.tfReady;
  }

  async loadModels() {
    await this.ensureTfReady();

    // Load both models in parallel
    const [detector, embedder] = await Promise.all([
      cocoSsd.load(),
      mobilenet.load()
    ]);
    this.detectorModel = detector;
    this.embeddingModel = embedder;
    console.log('[clothing-analysis] AI models loaded', {
      backend: tf.getBackend(),
      tfVersion: (tf as any).version_core ?? 'unknown',
    });
  }

  /**
   * Main entry point: Analyze an image file and return extracted items
   */
  async processImage(imageFile: File): Promise<DetectedItem[]> {
    await this.ensureTfReady();
    if (!this.detectorModel || !this.embeddingModel) await this.loadModels();

    // 1. Convert File to HTMLImageElement
    const imgElement = await this.fileToImageElement(imageFile);

    // 2. Detect Objects (The "Where")
    const predictions = await this.detectorModel!.detect(imgElement);
    console.log(
      '[clothing-analysis] raw predictions',
      predictions.map((p) => ({
        class: p.class,
        score: p.score,
        bbox: p.bbox,
      }))
    );

    // 3. Filter relevant classes (COCO-SSD detects cars/dogs too)
    // We keep only clothing / outfit-related classes and drop everything else.
    const relevantPredictions = predictions.filter(
      (p) => CLOTHING_RELATED_CLASSES.includes(p.class) && p.score >= 0.3
    );
    console.log(
      '[clothing-analysis] relevant predictions',
      relevantPredictions.map((p) => ({
        class: p.class,
        score: p.score,
        bbox: p.bbox,
      }))
    );

    const results: DetectedItem[] = [];

    // 4. Loop, Crop, and Embed
    for (const pred of relevantPredictions) {
      // Crop the item
      const cropBlob = await this.cropImage(imgElement, pred.bbox);
      
      // Convert Blob back to Image for Embedding
      const cropImgElement = await this.blobToImageElement(cropBlob);
      
      // Generate Embedding (The "Fingerprint")
      // infer(img, true) returns the internal 1024-dim vector, not the classification
      const embeddingTensor = this.embeddingModel!.infer(cropImgElement, true);
      const embedding = Array.from(await embeddingTensor.data()); // Convert Tensor to simple array
      embeddingTensor.dispose(); // Cleanup memory

      results.push({
        blob: cropBlob,
        category: pred.class,
        confidence: pred.score,
        embedding: embedding
      });
    }

    return results;
  }

  // --- Helper: Crop using Canvas ---
  private async cropImage(sourceImage: HTMLImageElement, bbox: [number, number, number, number]): Promise<Blob> {
    const [x, y, width, height] = bbox;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.drawImage(sourceImage, x, y, width, height, 0, 0, width, height);

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.95));
  }

  // --- Utilities ---
  private fileToImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(file);
    });
  }

  private blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(blob);
    });
  }
}