import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { authService } from '../services/authService';
import { favoriteProviderService } from '../services/favoriteProviderService';

// FavoriteProvidersContext — Customer-ის შენახული (favorite) ოსტატების
// id-ების სია. Customer ❤️-ს აჭერს ოსტატის საჯარო პროფილზე
// (ViewProviderProfileScreen), CustomerProfileScreen-ის "შენახული ოსტატები"
// კითხულობს (SavedProvidersScreen).
//
// #78: რეალურად Supabase-ზეა (`favorite_providers`, owner-only RLS,
// supabase/migrations/0031) — აქამდე სუფთა ლოკალური React state იყო,
// app restart-ის შემდეგ იკარგებოდა. Auth-სთან სინქრონიზაცია
// `authService.subscribeToAuthState`-ით ხდება (არა RootNavigator-ის
// session-restore-ის ცალკე ჰიდრატაციით, CustomerProfileContext-ის/
// ProviderProfileContext-ის მსგავსად) — ეს listener ერთდროულად ფარავს
// სამივე შემთხვევას ერთი კოდის ბილიკით: cold-start session restore,
// login, logout (favoriteIds ცარიელდება, არასწორად არ "გადმოჰყვება"
// წინა მომხმარებლის სესიიდან).
export type FavoriteProvidersContextValue = {
  favoriteIds: Set<string>;
  isFavorite: (providerId: string) => boolean;
  toggleFavorite: (providerId: string) => void;
};

const FavoriteProvidersContext = createContext<FavoriteProvidersContextValue | null>(null);

export function FavoriteProvidersProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const uidRef = useRef<string | null>(null);
  // toggle-ის დროს "in-flight" providerId-ების სინქრონული guard — სწრაფი
  // ორმაგი დაჭერის დროს ორივე taps ერთსა და იმავე ძველ `favoriteIds`-ს
  // "დაინახავდა" (React-ის state batching), რაც ორ ურთიერთსაწინააღმდეგო
  // Supabase-ის write-ს (insert+delete) გამოიწვევდა.
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthState((user) => {
      const nextUid = user?.uid ?? null;
      // `subscribeToAuthState` ყოველ auth event-ზე იძახება (login/logout-ის
      // გარდა TOKEN_REFRESHED-იც, პერიოდულად) — თუ uid იგივეა, ეს მხოლოდ
      // session-ის განახლებაა, არა ახალი მომხმარებელი; ხელახლა fetch-ი
      // ზედმეტიც იქნებოდა და risky-ც (შეიძლება in-flight optimistic
      // toggle-ს გადააწეროს ძველი მონაცემი).
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

    // Optimistic update — ჩატის/ჯობის retry-ის იგივე პრინციპით, ჩავარდნაზე
    // rollback.
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
        // ProviderHomeScreen-ის availability-toggle-ის იგივე პრინციპით —
        // ჩავარდნაზე ჩუმად rollback საკმარისი არაა, მომხმარებელმა უნდა
        // იცოდეს, რომ ❤️-ის მდგომარეობა რეალურად არ შენახულა.
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
