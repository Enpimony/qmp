import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';

declare const tflite: any;

export interface Detection {
  label: string;
  score: number;
  box: [number, number, number, number]; // [x, y, w, h]
}

@Injectable({ providedIn: 'root' })
export class YoloService {
  private model: any;
  private labels = ['jacket', 'jean', 'shirt']; 

  async loadModel() {
    // 1. Wait for the external scripts to load completely
    await this.ensureScriptsLoaded();

    console.log('Loading YOLO Model...');
    
    // 2. Access tflite from the window object safely
    const tflite = (window as any).tflite;
    
    // Optional: Set WASM path if auto-detection fails
    tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');

    this.model = await tflite.loadTFLiteModel('/assets/best_float32.tflite');
    console.log('YOLO Fashion Model Loaded');
  }

    // --- Helper: Dynamically inject scripts and wait ---
    private async ensureScriptsLoaded(): Promise<void> {
    if ((window as any).tflite) {
      return; // Already loaded, good to go
    }

    console.log('Injecting TFLite scripts...');
    
    // We must load them in specific order: Core -> Backend -> TFLite
    await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-cpu');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js');
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already exists to avoid duplicates
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(`Failed to load ${src}`);
      document.head.appendChild(script);
    });
  }

  async detect(image: HTMLImageElement): Promise<Detection[]> {
    if (!this.model) await this.loadModel();
    console.log('Detecting...', image);
    // 1. Preprocess Image (YOLO expects 640x640, normalized 0-1)
    const inputTensor = tf.tidy(() => {
      return tf.browser.fromPixels(image)
        .resizeNearestNeighbor([640, 640])
        .toFloat()
        .div(tf.scalar(255.0))
        .expandDims(0);
    });
    console.log('Input Tensor:', inputTensor);
    // 2. Run Inference
    const outputTensor = this.model!.predict(inputTensor) as tf.Tensor;
    const data = await outputTensor.data(); // Raw array [1, 4+Classes, 8400]
    console.log('Data:', data); 
    // 3. Post-Process (Decode the raw numbers)
    const detections = this.processOutput(data, image.width, image.height);
    console.log('Detections:', detections);
    // Cleanup memory
    inputTensor.dispose();
    outputTensor.dispose();
    console.log('After dispose:', detections);
    return detections;
  }

  // --- The Magic Helper Function (YOLO Decoder) ---
  private processOutput(data: Float32Array | Int32Array | Uint8Array, imgW: number, imgH: number): Detection[] {
    const boxes: any[] = [];
    const scores: number[] = [];
    const classIndices: number[] = [];

    // YOLOv8 Output Shape: [1, 8400, 4 + NumClasses] (Transposed)
    // We loop through the 8400 possible detections
    // Note: Dimensions might be flipped [4+Classes, 8400], check your specific export if this fails.
    // Assuming standard YOLOv8 export where rows = features, cols = anchors:
    const numAnchors = 8400;
    const numClasses = this.labels.length;
    const numFeatures = 4 + numClasses;

    for (let i = 0; i < numAnchors; i++) {
      // Find the class with the highest score for this anchor
      let maxScore = 0;
      let maxClassIndex = -1;

      // Class scores start at index 4
      for (let c = 0; c < numClasses; c++) {
        // Accessing data in column-major format often required for YOLO exports
        const score = data[(4 + c) * numAnchors + i]; 
        if (score > maxScore) {
          maxScore = score;
          maxClassIndex = c;
        }
      }

      if (maxScore > 0.5) { // Threshold (50% confidence)
        const x = data[0 * numAnchors + i]; // Center X (0-1 relative to 640)
        const y = data[1 * numAnchors + i]; // Center Y
        const w = data[2 * numAnchors + i]; // Width
        const h = data[3 * numAnchors + i]; // Height

        // Convert to absolute pixel coordinates
        const x1 = (x - w / 2) * 640;
        const y1 = (y - h / 2) * 640;
        
        // Scale back to original image size
        const scaleX = imgW / 640;
        const scaleY = imgH / 640;

        boxes.push([x1 * scaleX, y1 * scaleY, w * 640 * scaleX, h * 640 * scaleY]);
        scores.push(maxScore);
        classIndices.push(maxClassIndex);
      }
    }

    // 4. Non-Maximum Suppression (Remove overlapping boxes)
    // Note: This is a simplified NMS. For production, use tf.image.nonMaxSuppressionAsync
    return this.nms(boxes, scores, classIndices);
  }

  private nms(boxes: any[], scores: number[], classes: number[]): Detection[] {
    const result: Detection[] = [];
    if (boxes.length === 0) return result;

    // Simple greedy NMS
    // 1. Sort by score
    const sortedIndices = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).map(x => x.i);

    while (sortedIndices.length > 0) {
      const current = sortedIndices.shift()!;
      result.push({
        label: this.labels[classes[current]],
        score: scores[current],
        box: boxes[current]
      });

      // Filter out overlapping boxes
      for (let i = sortedIndices.length - 1; i >= 0; i--) {
        const other = sortedIndices[i];
        if (this.iou(boxes[current], boxes[other]) > 0.4) { // IoU Threshold
          sortedIndices.splice(i, 1);
        }
      }
    }
    return result;
  }

  private iou(boxA: number[], boxB: number[]): number {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[0] + boxA[2], boxB[0] + boxB[2]);
    const yB = Math.min(boxA[1] + boxA[3], boxB[1] + boxB[3]);

    const interW = Math.max(0, xB - xA);
    const interH = Math.max(0, yB - yA);
    const intersection = interW * interH;
    
    const boxAArea = boxA[2] * boxA[3];
    const boxBArea = boxB[2] * boxB[3];

    return intersection / (boxAArea + boxBArea - intersection);
  }
}