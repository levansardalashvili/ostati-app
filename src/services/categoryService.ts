import { supabase } from './supabaseClient';
import { CATEGORIES as STATIC_CATEGORIES } from '../data/categories';
import type { CategoryRecord } from '../types/category';

// `categories` ცხრილის Postgres row shape (supabase/migrations/0043).
type CategoryRow = {
  id: string;
  name: string;
  icon_key: string;
  sort_order: number;
  is_active: boolean;
  featured: boolean;
};

function fromRow(row: CategoryRow): CategoryRecord {
  return {
    id: row.id,
    name: row.name,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    featured: row.featured,
  };
}

// ძველი, ჰარდქოდილი TOP_CATEGORY_IDS (CustomerHomeScreen.tsx-ის
// წინანდელი მუდმივა) — მხოლოდ სტატიკური fallback-ის `featured`-ის
// გამოსათვლელად, რომ ქსელის გარეშე პირველ ჩატვირთვაზეც სწორი "ტოპ 3"
// გამოჩნდეს.
const FALLBACK_FEATURED_IDS = new Set(['plumbing', 'electrical', 'cleaning']);

// სტატიკური, build-time fallback — `src/data/categories.ts`-ის უკვე
// არსებული მასივიდან აგებული (task: "preserve existing category IDs").
// გამოიყენება (ა) startup-ზე, backend-ის პირველ pull-მდე, და (ბ) ქსელის/
// Supabase-ის დროებით ჩავარდნაზე — task: "safe local fallback/cache for
// temporary network failure".
const STATIC_FALLBACK: CategoryRecord[] = STATIC_CATEGORIES.map((c, i) => ({
  id: c.id,
  name: c.label,
  iconKey: '',
  sortOrder: i,
  isActive: true,
  featured: FALLBACK_FEATURED_IDS.has(c.id),
}));

// მარტივი module-level cache — ბოლო წარმატებული fetch-ის შედეგი, ან,
// მანამდე/ჩავარდნაზე, სტატიკური fallback. `deriveJobTitle` (jobService.ts)
// და სხვა სინქრონული გამომძახებლები ამას კითხულობენ პირდაპირ, ცალკე
// async round-trip-ის გარეშე.
let cache: CategoryRecord[] = STATIC_FALLBACK;

export interface CategoryService {
  // ბექენდიდან რეალური სია (`sort_order`-ით დალაგებული) — წარმატებაზე
  // ავსებს/ანახლებს `cache`-ს. ქსელის/query-ის ჩავარდნაზე **არ** isvris
  // შეცდომას — ბოლო ცნობილ cache-ს (backend-დან, თუ ადრე ჩატვირთულა,
  // თორემ სტატიკურ fallback-ს) აბრუნებს, რომ ეკრანები ცარიელი/crashed
  // მდგომარეობის ნაცვლად მაინც სწორად აისახოს.
  listCategories(): Promise<CategoryRecord[]>;
  // სინქრონული — ბოლო ცნობილი სია, loading-ის გარეშე (საწყისი render-ისთვის).
  getCached(): CategoryRecord[];
  // ერთი კატეგორიის სახელი id-ით, სინქრონული (cache-ზეა აგებული) —
  // jobService.ts-ის deriveJobTitle()-ის და მსგავსი call site-ების
  // ჩანაცვლება, ადრინდელი `CATEGORIES.find(...)`-ის ნაცვლად.
  getCategoryName(id: string): string;
}

export const categoryService: CategoryService = {
  async listCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
    if (error || !data) {
      return cache;
    }
    cache = (data as CategoryRow[]).map(fromRow);
    return cache;
  },
  getCached() {
    return cache;
  },
  getCategoryName(id) {
    return cache.find((c) => c.id === id)?.name ?? id;
  },
};
