
import { Component } from '@angular/core';
import { ClothingAnalysisService } from '../../services/clothing-analysis.service'; // Adjust path as needed
import { CommonModule } from '@angular/common';
import { StorageService } from '../../services/storage.service';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';

// Interface for what is displayed in the HTML
interface ProcessedItemView {
  displayUrl: string; 
  category: string;
  confidence: number;
  isDuplicate: boolean;
}

@Component({
    selector: 'app-clothing-analysis',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './clothing-analysis.component.html',
    styleUrl: './clothing-analysis.component.css'
  })
export class ClothingAnalysisComponent {
  isAnalyzing = false;
  processedItems: ProcessedItemView[] = [];

  constructor(
    private analyzer: ClothingAnalysisService,
    private storageService: StorageService,
    private inventoryService: InventoryService,
    private authService: AuthService
  ) {}

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isAnalyzing = true;
    this.processedItems = []; // Clear previous results

    try {
      console.groupCollapsed('[clothing-analysis] analyze');
      console.log('file:', { name: file.name, type: file.type, size: file.size });

      // 1. Run AI Analysis
      const detectedItems = await this.analyzer.processImage(file);
      console.log(
        'detectedItems:',
        detectedItems.map((x) => ({
          category: x.category,
          confidence: x.confidence,
          embeddingDims: x.embedding?.length,
        }))
      );

      // 2. Iterate through results
      for (const item of detectedItems) {
        
        // A. Check for Duplicates (Client-side logic)
        const isDuplicate = await this.checkForDuplicate(item.embedding);
        console.log(
          `candidate: ${item.category} @ ${(item.confidence * 100).toFixed(1)}% -> duplicate=${isDuplicate}`
        );

        // B. Add to View Array immediately
        this.processedItems.push({
          displayUrl: URL.createObjectURL(item.blob),
          category: item.category,
          confidence: item.confidence,
          isDuplicate: isDuplicate
        });

        // C. If NOT duplicate, Upload to Firebase
        if (!isDuplicate) {
          await this.uploadAndSave(item);
        } else {
            console.log(`Skipped duplicate ${item.category}`);
        }
      }

    } catch (error) {
      console.error('Error analyzing image:', error);
    } finally {
      console.groupEnd();
      this.isAnalyzing = false;
    }
  }

  // --- Upload Logic ---
  private async uploadAndSave(item: any) {
    const userId = this.authService.currentUserId;
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Keep all uploads under the same per-user folder pattern as the rest of the app
    const filePath = this.storageService.getUserUploadPath(
      userId,
      `clothes/${Date.now()}_${item.category}.jpg`
    );

    // Ensure we upload a File (StorageService expects a File)
    const uploadFile =
      item.blob instanceof File
        ? (item.blob as File)
        : new File([item.blob], `${item.category}.jpg`, {
            type: item.blob?.type || 'image/jpeg',
          });

    const downloadUrl = await this.storageService.uploadFile(uploadFile, filePath);

    const id = await this.inventoryService.addItem({
      category: item.category,
      imageUrl: downloadUrl,
      embedding: item.embedding, // Critical for future matching
    });
    console.log('saved inventory item:', { id, category: item.category, filePath });
  }

  // --- Matching Logic (Cosine Similarity) ---
  private async checkForDuplicate(newVector: number[]): Promise<boolean> {
    const recent = await this.inventoryService.getRecentItemsForCurrentUser(50);
    if (!recent.length) return false;

    let best = -1;
    let bestCat: string | undefined;
    for (const item of recent) {
      if (!item.embedding) continue;
      const similarity = this.cosineSimilarity(newVector, item.embedding);
      if (similarity > best) {
        best = similarity;
        bestCat = item.category;
      }
      // Threshold: 0.90 is usually a very strong visual match
      if (similarity > 0.90) {
        console.log('duplicate match:', { similarity, matchedCategory: item.category, matchedId: item.id });
        return true;
      }
    }

    console.log('no duplicate match:', { bestSimilarity: best, bestCategory: bestCat });
    return false;
  }

  // Math helper
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}