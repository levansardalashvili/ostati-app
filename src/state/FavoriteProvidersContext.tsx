import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { authService } from '../services/authService';
import { favoriteProviderService } from '../services/favoriteProviderService';

// Saved providers (favorite_providers). Follows auth state: loads on login /
// cold start, clears on logout.
export type FavoriteProvidersContextValue = {
  favoriteIds: Set<string>;
  isFavorite: (providerId: string) => boolean;
  toggleFavorite: (providerId: string) => void;
};

const FavoriteProvidersContext = createContext<FavoriteProvidersContextValue | null>(null);

export function FavoriteProvidersProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const uidRef = useRef<string | null>(null);
  // Synchronous guard: a fast double tap would otherwise send insert + delete.
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthState((user) => {
      const nextUid = user?.uid ?? null;
      // Same uid = token refresh, not a new user — don't refetch (it could undo an in-flight toggle).
      if (nextUid === uidRef.current) return;
      uidRef.current = nextUid;
      if (!nextUid) {
        setFavoriteIds(new Set());
        return;
      }
      favoriteProviderService
        .listMyFavoriteIds(nextUid)
        .then((ids) => setFavoriteIds(ids))
        .catch(() => {});
    });
    return unsubscribe;
  }, []);

  const isFavorite = (providerId: string) => favoriteIds.has(providerId);

  const toggleFavorite = (providerId: string) => {
    const uid = uidRef.current;
    if (!uid || inFlightRef.current.has(providerId)) return;
    const wasFavorite = favoriteIds.has(providerId);
    inFlightRef.current.add(providerId);

    // Optimistic, rolled back on failure.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(providerId);
      else next.add(providerId);
      return next;
    });

    const action = wasFavorite
      ? favoriteProviderService.removeFavorite(uid, providerId)
      : favoriteProviderService.addFavorite(uid, providerId);

    action
      .catch(() => {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(providerId);
          else next.delete(providerId);
          return next;
        });
        // Tell the user the ❤️ wasn't saved.
        Alert.alert(
          'ვერ მოხერხდა',
          wasFavorite
            ? 'ოსტატის შენახულებიდან ამოშლა ვერ მოხერხდა — სცადე თავიდან.'
            : 'ოსტატის შენახვა ვერ მოხერხდა — სცადე თავიდან.',
        );
      })
      .finally(() => {
        inFlightRef.current.delete(providerId);
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
