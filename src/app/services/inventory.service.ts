import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {


  private supabaseService = inject(SupabaseService);

  async getMyClothes(expirySeconds = 60) {
    const supabase = this.supabaseService.getClient();
    const { data: clothes, error } = await supabase
      .from('clothes_with_images')
      .select('*');
  
    if (error) throw error
  
    const results = await Promise.all(clothes.map(async (item) => {
      const images = await Promise.all((item.images || []).map(async (img: any) => {
        if (!img.storage_path) return { ...img, signedUrl: null }
  
        const { data, error: urlErr } = await supabase
          .storage
          .from('clothes-images')
          .createSignedUrl(img.storage_path, expirySeconds);
  
        return {
          ...img,
          signedUrl: urlErr ? null : data.signedUrl
        }
      }))
  
      return { ...item, images };
    }))
  
    return results
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
    const deletedClothes = await this.supabaseService.deleteClothes(clothesId);
    console.log('Deleted clothes:', deletedClothes);
    return deletedClothes;
  }

  async insertPhoto(clothesId: string, file: File) {
    const supabase = this.supabaseService.getClient();
    const ownerId = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user?.id : 'anonymous'
  
    const destPath = `${ownerId}/${Date.now()}-${file.name}`
  
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('clothes-images')
      .upload(destPath, file, { cacheControl: '3600', upsert: false })
  
    if (uploadError) {
      console.error('Upload error', uploadError)
      return
    }
  
    const { data: publicUrl } = supabase.storage.from('clothes-images').getPublicUrl(uploadData.path || destPath)
    const url = publicUrl?.publicUrl
  
    const { data, error } = await supabase
      .from('clothes_images')
      .insert([{
        clothes_id: clothesId,
        storage_bucket: 'clothes-images',
        storage_path: uploadData.path || destPath,
        url,
        dominant_color: null,
        palette: [],
        metadata: {},
        owner_id: ownerId,
        is_public: false
      }])
      .select()
      .single()
  
    if (error) {
      console.error('Insert error', error)
      return
    }
    console.log('Inserted image record', data)
    return data;
  }
}

