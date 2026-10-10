import { supabase } from './supabaseClient';

// Only provider ids are stored; SavedProvidersScreen loads the providers.
const UNIQUE_VIOLATION = '23505';

export const favoriteProviderService = {
  async listMyFavoriteIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('favorite_providers').select('provider_id').eq('user_id', userId);
    if (error) throw error;
    return new Set((data as { provider_id: string }[]).map((r) => r.provider_id));
  },
  async addFavorite(userId: string, providerId: string): Promise<void> {
    const { error } = await supabase.from('favorite_providers').insert({ user_id: userId, provider_id: providerId });
    // 0031-ის კომპოზიტური primary key (user_id, provider_id) უკვე
    // გარანტიას იძლევა, რომ დუბლირებული insert ვერასდროს შეიქმნება —
    // მხოლოდ ეს კონკრეტული შეცდომა (unique_violation) ჩუმად იბლოკება
    // (მაგ. ორი მოწყობილობიდან თითქმის ერთდროული toggle), დანარჩენი კვლავ იჭერს.
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  },
  async removeFavorite(userId: string, providerId: string): Promise<void> {
    const { error } = await supabase.from('favorite_providers').delete().eq('user_id', userId).eq('provider_id', providerId);
    if (error) throw error;
  },
};
