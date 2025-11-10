import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {


  private supabaseService = inject(SupabaseService);

  async getMyClothes() {
    const { data, error } = await this.supabaseService.getClient().from('clothes').select('*');
    return data;
  }

  async insertClothes(clothes: any) {
    const newClothes = {
      name: clothes.name,
      slot: clothes.slot,
      is_public: clothes.is_public
    }

    const insertRes = await this.supabaseService.getClient()
      .from('clothes')
      .insert([newClothes])
      .select()
      .single();

    if (insertRes.error) {
      throw insertRes.error
    }

    const insertedCloth = insertRes.data;
    console.log('Inserted cloth:', insertedCloth);

    return insertedCloth;
  }

  async deleteClothes(clothesId: string) {
    // const deletedClothes = await this.supabaseService.deleteRow('clothes', { id: clothesId });
    // return deletedClothes;

    const deletedClothes = await this.supabaseService.deleteClothes(clothesId);
    console.log('Deleted clothes:', deletedClothes);
    return deletedClothes;
  }
}

