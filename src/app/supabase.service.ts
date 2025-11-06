import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);

  constructor() {
    const SUPABASE_URL = 'https://zwzwcmsgoeooucezunci.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3endjbXNnb2Vvb3VjZXp1bmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNjIxMzEsImV4cCI6MjA3NzkzODEzMX0.EPymVIumK2xwf_-1v6Pc29-ljXO6kjqTRXeyYz6cCvw';

    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.initializeAuth();
  }

  private async initializeAuth() {
    const { data } = await this.supabase.auth.getSession();
    this.session.set(data.session ?? null);
    this.user.set(data.session?.user ?? null);

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session ?? null);
      this.user.set(session?.user ?? null);
    });
  }

  async signInWithGoogle(redirectTo?: string) {
    return this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || window.location.origin },
    });
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }

  isLoggedIn() {
    return !!this.session();
  }

  /**
   * Simple SELECT — all outfits
   * @param columns Optional specific columns to select (default: '*')
   */
  async getAllOutfits(columns: string = '*') {
    const { data, error } = await this.supabase
      .from('outfits')
      .select(columns)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * SELECT with related aggregated items (outfits_with_clothes view)
   * @param ownerId Optional owner ID to filter by
   */
  async getOutfitsWithClothes(ownerId?: string) {
    let query = this.supabase.from('outfits_with_clothes').select('*');

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * SELECT with join-like pattern using foreign key relationships
   * Fetch an outfit and include clothes via outfits_items
   * @param outfitId The UUID of the outfit to fetch
   */
  async getOutfitWithItems(outfitId: string) {
    const { data, error } = await this.supabase
      .from('outfits')
      .select(`
        id,
        name,
        owner_id,
        outfits_items (
          id,
          clothes_id,
          position,
          added_at,
          clothes:clothes_id (*)
        )
      `)
      .eq('id', outfitId);

    if (error) throw error;
    return data;
  }

  /**
   * INSERT single outfit
   * @param outfit The outfit object to insert
   */
  async insertOutfit(outfit: {
    id?: string;
    name: string;
    owner_id: string;
    is_public?: boolean;
  }) {
    const { data, error } = await this.supabase
      .from('outfits')
      .insert([outfit])
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * INSERT outfit item (outfits_items)
   * @param item The outfit item to insert
   */
  async insertOutfitItem(item: {
    outfit_id: string;
    clothes_id: string;
    position: number;
    owner_id: string;
    is_public?: boolean;
  }) {
    const { data, error } = await this.supabase
      .from('outfits_items')
      .insert([item])
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * UPDATE single row
   * @param table The table name
   * @param updates The fields to update
   * @param id The UUID of the row to update
   */
  async updateRow<T extends Record<string, any>>(
    table: string,
    updates: Partial<T>,
    id: string
  ) {
    const { data, error } = await this.supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * UPDATE clothes item
   * @param clothesId The UUID of the clothes item
   * @param updates The fields to update
   */
  async updateClothes(clothesId: string, updates: Partial<{ name: string; is_public: boolean }>) {
    return this.updateRow('clothes', updates, clothesId);
  }

  /**
   * DELETE single row
   * @param table The table name
   * @param matchConditions Conditions to match the row(s) to delete
   */
  async deleteRow(table: string, matchConditions: Record<string, any>) {
    let query = this.supabase.from(table).delete();

    // Apply all match conditions
    Object.entries(matchConditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.select();

    if (error) throw error;
    return data;
  }

  /**
   * DELETE outfit item
   * @param outfitId The outfit UUID
   * @param clothesId The clothes UUID
   */
  async deleteOutfitItem(outfitId: string, clothesId: string) {
    return this.deleteRow('outfits_items', { outfit_id: outfitId, clothes_id: clothesId });
  }

  /**
   * UPSERT (insert or update on conflict)
   * @param table The table name
   * @param row The row to upsert
   * @param onConflict Array of column names that form the unique constraint
   */
  async upsertRow<T extends Record<string, any>>(
    table: string,
    row: T,
    onConflict: string[]
  ) {
    const { data, error } = await this.supabase
      .from(table)
      .upsert(row, { onConflict: onConflict.join(',') })
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * UPSERT outfit item
   * @param item The outfit item to upsert
   */
  async upsertOutfitItem(item: {
    outfit_id: string;
    clothes_id: string;
    position: number;
    owner_id: string;
    is_public?: boolean;
  }) {
    return this.upsertRow('outfits_items', item, ['outfit_id', 'clothes_id']);
  }

  /**
   * Call stored procedure (RPC)
   * @param functionName The name of the Postgres function
   * @param params The parameters to pass to the function
   */
  async callRPC<T = any>(functionName: string, params?: Record<string, any>) {
    const { data, error } = await this.supabase.rpc(functionName, params || {});

    if (error) throw error;
    return data as T;
  }

  /**
   * Create outfit with items atomically using RPC
   * @param outfitName The name of the outfit
   * @param owner The owner UUID
   * @param items Array of items with clothes_id, position, and is_public
   */
  async createOutfitWithItems(
    outfitName: string,
    owner: string,
    items: Array<{ clothes_id: string; position: number; is_public: boolean }>
  ) {
    return this.callRPC<{ outfit_id: string }>('create_outfit_with_items', {
      outfit_name: outfitName,
      owner: owner,
      items: items,
    });
  }

  /**
   * Unsubscribe from a channel
   * @param channel The channel to unsubscribe from
   */
  unsubscribe(channel: RealtimeChannel) {
    return this.supabase.removeChannel(channel);
  }

  /**
   * Get the Supabase client instance (for advanced usage)
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }


  async addClothAndFetch() {
    const newCloth = {
        name: 'Camisa blanca de flores',
        slot: 'torso',
        is_public: true,
        owner_id: this.user()?.id ?? ''
      }
  
      const insertRes = await this.supabase
        .from('clothes')
        .insert([newCloth])
        .select()
        .single();
  
      if (insertRes.error) {
        throw insertRes.error
      }
  
      const insertedCloth = insertRes.data;
      console.log('Inserted cloth:', insertedCloth);
  
      const clothId = insertedCloth.id;
  
      const fetchById = await this.supabase
        .from('clothes')
        .select('*')
        .eq('id', clothId)
        .single()
  
      if (fetchById.error) throw fetchById.error;
      console.log('Fetched by id:', fetchById.data);
  
      const fetchByName = await this.supabase
        .from('clothes')
        .select('id, name, slot')
        .ilike('name', '%flores%')
        .order('created_at', { ascending: false })
        .limit(10)
  
      if (fetchByName.error) throw fetchByName.error
      console.log('Fetched by name filter (matching "flores"):', fetchByName.data);
  
      return { inserted: insertedCloth, byId: fetchById.data, byName: fetchByName.data }
  }
  
}

