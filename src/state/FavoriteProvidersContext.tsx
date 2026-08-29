import React, { createContext, useContext, useState } from 'react';

// FavoriteProvidersContext — Customer-ის შენახული (favorite) ოსტატების
// id-ების სია. Customer ❤️-ს აჭერს ოსტატის საჯარო პროფილზე
// (ViewProviderProfileScreen), CustomerProfileScreen-ის "შენახული ოსტატები"
// კითხულობს (SavedProvidersScreen). სუფთა ლოკალური React state — Supabase-ს
// არასდროს არ დაკავშირებია (განზრახ, დოკუმენტირებული, `supabase/README.md`-ის
// "Deliberately not included" — favorites/saved_providers ცხრილი არ არსებობს).
// TODO: მომავალში საკუთარი `favorites` ცხრილით (owner-only RLS), თუ საჭირო გახდება.
type FavoriteProvidersContextValue = {
  favoriteIds: Set<string>;
  isFavorite: (providerId: string) => boolean;
  toggleFavorite: (providerId: string) => void;
};

const FavoriteProvidersContext = createContext<FavoriteProvidersContextValue | null>(null);

export function FavoriteProvidersProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const isFavorite = (providerId: string) => favoriteIds.has(providerId);

  const toggleFavorite = (providerId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  return (
    <FavoriteProvidersContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoriteProvidersContext.Provider>
  );
}

export function useFavoriteProviders() {
  const ctx = useContext(FavoriteProvidersContext);
  if (!ctx) throw new Error('useFavoriteProviders must be used within FavoriteProvidersProvider');
  return ctx;
}
