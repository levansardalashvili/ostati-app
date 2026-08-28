import type { MediaItem } from '../components/MediaUploadGrid';
import type { SpecialtyOption } from '../components/SpecialtyPickerField';

// საჯარო ოსტატის ჩანაწერი (directory listing entity) — Customer-ის მხრიდან
// ჩანს ყველგან (Home, კატეგორიის სია, საჯარო პროფილი, შენახული ოსტატები).
// TODO: ჩანაცვლდება Firestore-ის providerProfiles/{uid}-ის საჯარო ველებით.
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
  online: boolean;
  initials: string;
  color: string;
  bio: string;
  skills: string[];
  certificates: MediaItem[];
  portfolio: MediaItem[];
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
// TODO: ჩანაცვლდება Firestore-ის providerProfiles/{uid} დოკუმენტით.
export type ProviderProfile = {
  firstName: string;
  lastName: string;
  specialty: SpecialtyOption[];
  areas: string[];
  experience: string | null;
  about: string;
  hasPhoto: boolean;
  certificates: MediaItem[];
  portfolio: MediaItem[];
  sqmPrices: Record<string, string>;
};
