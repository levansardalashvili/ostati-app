// Backend-driven category record (supabase/migrations/0043) — `id`
// matches the same ids `src/data/categories.ts`'s static `Category`
// (id/label/bg/dot, presentation-only) has always used. Kept as a
// SEPARATE type on purpose: bg/dot are code-level design tokens, not
// backend data, and the two types are never meant to be interchangeable.
export type CategoryRecord = {
  id: string;
  name: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  featured: boolean;
};
