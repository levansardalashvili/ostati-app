import { supabase } from './supabaseClient';
import { CATEGORIES as STATIC_CATEGORIES, isSqmPriced as staticIsSqmPriced } from '../data/categories';
import type { CategoryRecord } from '../types/category';

type CategoryRow = {
  id: string;
  name: string;
  icon_key: string;
  sort_order: number;
  is_active: boolean;
  featured: boolean;
  price_per_sqm: boolean;
};

function fromRow(row: CategoryRow): CategoryRecord {
  return {
    id: row.id,
    name: row.name,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    featured: row.featured,
    pricePerSqm: row.price_per_sqm ?? false,
  };
}

// Featured ids for the offline fallback.
const FALLBACK_FEATURED_IDS = new Set(['plumbing', 'electrical', 'cleaning']);

// Static fallback (data/categories.ts) until the first fetch or when offline.
const STATIC_FALLBACK: CategoryRecord[] = STATIC_CATEGORIES.map((c, i) => ({
  id: c.id,
  name: c.label,
  iconKey: '',
  sortOrder: i,
  isActive: true,
  featured: FALLBACK_FEATURED_IDS.has(c.id),
  pricePerSqm: staticIsSqmPriced(c.id),
}));

// Last good list (or the fallback) for synchronous readers.
let cache: CategoryRecord[] = STATIC_FALLBACK;

export const categoryService = {
  // Never throws — on failure returns the last known list.
  async listCategories(): Promise<CategoryRecord[]> {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
    if (error || !data) {
      return cache;
    }
    cache = (data as CategoryRow[]).map(fromRow);
    return cache;
  },
  getCached(): CategoryRecord[] {
    return cache;
  },
  getCategoryName(id: string): string {
    return cache.find((c) => c.id === id)?.name ?? id;
  },
  // Show the per-m² price field for this profession? (never for custom:*)
  isSqmPriced(id: string): boolean {
    return cache.find((c) => c.id === id)?.pricePerSqm ?? false;
  },
};
