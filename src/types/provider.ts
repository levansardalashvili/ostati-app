import type { MediaItem } from '../components/MediaUploadGrid';
import type { SpecialtyOption } from '../components/SpecialtyPickerField';

// Written only by the server/admin; `verified` = (status === 'verified').
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

// A provider as customers see it (public directory).
export type Provider = {
  id: string;
  name: string;
  category: string;
  // all professions' categories (`category` is just the first) — filters search all of them
  categories: string[];
  years: number;
  rating: number;
  reviews: number;
  location: string;
  areas: string[];
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
  photoUrl?: string;
  // price per m² for professions priced that way (categories.price_per_sqm)
  sqmPrice?: string;
  // profession labels for the public profile
  specialties: string[];
};

// The provider's own editable profile (ProviderProfileContext, setup and edit screens).
export type ProviderProfile = {
  firstName: string;
  lastName: string;
  specialty: SpecialtyOption[];
  areas: string[];
  experience: string | null;
  about: string;
  photoUrl?: string;
  certificates: MediaItem[];
  portfolio: MediaItem[];
  sqmPrices: Record<string, string>;
  // Read-only for the client (never sent on save). Optional: unknown before the profile row exists.
  verificationStatus?: VerificationStatus;
  verificationRequestedAt?: string | null;
  verificationRejectionReason?: string | null;
};
