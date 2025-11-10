import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import {
  ItemGroupComponent,
  ItemComponent,
  ItemContentComponent,
  ItemTitleComponent,
  ItemDescriptionComponent,
  ItemActionsComponent,
} from '../../components/item/item.component';
import { RadioGroupComponent } from '../../components/radio-group/radio-group.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ItemGroupComponent,
    ItemComponent,
    ItemContentComponent,
    ItemTitleComponent,
    ItemDescriptionComponent,
    ItemActionsComponent,
    RadioGroupComponent,
  ],
  templateUrl: './inventory.page.component.html',
  styleUrls: ['./inventory.page.component.scss'],
})
export class InventoryPageComponent implements OnInit {
  
  private inventoryService = inject(InventoryService);
  private fb = inject(FormBuilder);

  myClothes = signal<any[]>([]);
  slotOptions = ['head', 'torso', 'legs', 'feet'];

  clothesForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    slot: ['torso', [Validators.required]],
    is_public: [true]
  });

  async ngOnInit() {
    await this.loadClothes();
  }

  async loadClothes() {
    try {
      const clothes = await this.inventoryService.getMyClothes();
      this.myClothes.set(clothes || []);
    } catch (error) {
      console.error('Error loading clothes:', error);
    }
  }

  async insertClothes() {
    if (this.clothesForm.valid) {
      const clothes = this.clothesForm.value;
      const insertedClothes = await this.inventoryService.insertClothes(clothes);
      console.log('Inserted clothes:', insertedClothes);
      this.clothesForm.reset({ slot: 'torso', is_public: true });
      await this.loadClothes();
    }
  }

  getRadioLabelClasses(isChecked: boolean): string {
    return isChecked 
      ? 'border-primary bg-accent text-accent-foreground' 
      : 'border-input';
  }

  getRadioButtonClasses(isChecked: boolean): string {
    return isChecked 
      ? 'border-primary' 
      : 'border-input';
  }

  async deleteClothes(clothesId: string) {
    try {
      await this.inventoryService.deleteClothes(clothesId);
      await this.loadClothes();
    } catch (error) {
      console.error('Error deleting clothes:', error);
    }
  }
}
