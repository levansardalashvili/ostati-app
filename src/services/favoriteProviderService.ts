import { supabase } from './supabaseClient';

// `favorite_providers` ცხრილი — Customer-ის შენახული ოსტატები (#78,
// supabase/migrations/0031). მხოლოდ provider_id-ების წყვილია ინახება,
// არა Provider-ის სრული ობიექტი — `SavedProvidersScreen` ისედაც
// ცალკე კითხულობს სრულ Provider-ებს (`userService.listRealProviders`)
// და ლოკალურად filter-ავს ამ id-ების მიხედვით.
const UNIQUE_VIOLATION = '23505';

export interface FavoriteProviderService {
  listMyFavoriteIds(userId: string): Promise<Set<string>>;
  addFavorite(userId: string, providerId: string): Promise<void>;
  removeFavorite(userId: string, providerId: string): Promise<void>;
}

export const favoriteProviderService: FavoriteProviderService = {
  async listMyFavoriteIds(userId) {
    const { data, error } = await supabase.from('favorite_providers').select('provider_id').eq('user_id', userId);
    if (error) throw error;
    return new Set((data as { provider_id: string }[]).map((r) => r.provider_id));
  },
  async addFavorite(userId, providerId) {
    const { error } = await supabase.from('favorite_providers').insert({ user_id: userId, provider_id: providerId });
    // 0031-ის კომპოზიტური primary key (user_id, provider_id) უკვე
    // გარანტიას იძლევა, რომ დუბლირებული insert ვერასდროს შეიქმნება —
    // მხოლოდ ეს კონკრეტული შეცდომა (unique_violation) ჩუმად იბლოკება
    // (მაგ. ორი მოწყობილობიდან თითქმის ერთდროული toggle), დანარჩენი კვლავ იჭერს.
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  },
  async removeFavorite(userId, providerId) {
    const { error } = await supabase.from('favorite_providers').delete().eq('user_id', userId).eq('provider_id', providerId);
    if (error) throw error;
  },
};
