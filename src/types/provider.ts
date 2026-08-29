import type { MediaItem } from '../components/MediaUploadGrid';
import type { SpecialtyOption } from '../components/SpecialtyPickerField';

// Provider-ის ვერიფიკაციის სტატუსი (Task 3) — `provider_profiles.verification_status`-ის
// ზუსტი ანარეკლი (supabase/migrations/0025). Provider-ს არასდროს არ
// შეუძლია ეს თავად შეიცვალოს (RLS-ით ჩაკეტილია, owner-ის UPDATE-ის WITH
// CHECK-ში) — მხოლოდ სანდო backend (მომავალი admin ვერიფიკაციის flow,
// service_role-ით) ცვლის. `verified: boolean` (ქვემოთ) ამ ველის უბრალო
// წარმოებულია (`=== 'verified'`), საჯარო ბეჯის არსებული UI-ს
// (5 ეკრანი, `p.verified && <VerifiedBadge/>`) რომ არ დასჭირდეს შეხება.
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

// საჯარო ოსტატის ჩანაწერი (directory listing entity) — Customer-ის მხრიდან
// ჩანს ყველგან (Home, კატეგორიის სია, საჯარო პროფილი, შენახული ოსტატები).
// რეალურად Supabase-ის `provider_profiles` ცხრილზეა აგებული (#60,
// userService.ts-ის `listRealProviders`/`getRealProviderById`).
export type Provider = {
  id: string;
  name: string;
  category: string;
  years: number;
  rating: number;
  reviews: number;
  location: string;
  areas: string[];
  price: string;
  jobs: number;
  verified: boolean;
  verificationStatus: VerificationStatus;
  online: boolean;
  initials: string;
  color: string;
  bio: string;
  skills: string[];
  certificates: MediaItem[];
  portfolio: MediaItem[];
  // რეალური პროფილის ფოტოს URL (#65) — Supabase Storage-ში ატვირთული,
  // `undefined` როცა ფოტო არ აქვს ატვირთული (Avatar-ი ინიციალებზე vardebა).
  photoUrl?: string;
  // ამ ოსტატის კვ.მ-ის ფასი (თუ მისი სპეციალობა კვადრატულობით ითვლება —
  // src/data/specialties.ts-ის pricePerSqm). Customer-ის job detail-ზე
  // "დაინტერესებული ოსტატის" ბარათზე ჩნდება, თუ ცალკე შეთავაზებული ფასი არ არის.
  sqmPrice?: string;
  // საჯარო პროფილზე საჩვენებელი სპეციალობების სია — `category`-სგან
  // დამოუკიდებელია, რომელიც მხოლოდ ფილტრაციისთვის რჩება ერთადერთ მნიშვნელობად.
  specialties: string[];
};

// Provider-ის საკუთარი, რედაქტირებადი პროფილის draft — ProviderProfileContext-ის
// state-ის ფორმა (ProviderSetup/ProviderEditProfile-ის საერთო ველები).
// რეალურად Supabase-ის იმავე `provider_profiles` ცხრილზეა აგებული (#53,
// userService.ts-ის `getProviderProfileRecord`/`upsertProviderProfileRecord`).
export type ProviderProfile = {
  firstName: string;
  lastName: string;
  specialty: SpecialtyOption[];
  areas: string[];
  experience: string | null;
  about: string;
  // რეალური პროფილის ფოტოს URL (#65) — Supabase Storage-ში ატვირთული.
  // ადრე იყო `hasPhoto: boolean` (ლოკალური ტოგლი, ფოტოს გარეშე) — #65-ში
  // ჩანაცვლდა, რადგან რეალური ატვირთვისთვის ლოკალური boolean აზრს
  // კარგავს (URL-ის არსებობა თავად უკვე გვეუბნება "ფოტო აქვს თუ არა").
  photoUrl?: string;
  certificates: MediaItem[];
  portfolio: MediaItem[];
  sqmPrices: Record<string, string>;
};
