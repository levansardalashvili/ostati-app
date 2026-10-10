import { supabase } from './supabaseClient';
import type { CustomerProfile, UserRecord } from '../types/user';
import type { Provider, ProviderProfile, VerificationStatus } from '../types/provider';

type UserRow = {
  id: string;
  role: UserRecord['role'];
  first_name: string;
  last_name: string;
  email: string;
  default_address: string;
  phone: string;
  entrance: string;
  apartment: string;
  door_code: string;
  is_private_house: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
};

function fromRow(row: UserRow): UserRecord {
  return {
    role: row.role,
    // Null names have been seen in live rows despite the NOT NULL default — guard here (.charAt crash).
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email,
    defaultAddress: row.default_address,
    phone: row.phone ?? '',
    entrance: row.entrance ?? '',
    apartment: row.apartment ?? '',
    doorCode: row.door_code ?? '',
    isPrivateHouse: !!row.is_private_house,
    suspended: !!row.suspended_at,
    suspensionReason: row.suspension_reason ?? null,
  };
}

// Names are duplicated here because provider_profiles is public-read and users is not.
type ProviderProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  specialty: ProviderProfile['specialty'];
  areas: string[];
  experience: string | null;
  about: string;
  photo_url: string | null;
  certificates: ProviderProfile['certificates'];
  portfolio: ProviderProfile['portfolio'];
  sqm_prices: Record<string, string>;
  // Client can never write this (column grants) — safe to trust.
  verification_status: VerificationStatus;
  is_available: boolean;
};

// Verification request details live in a separate owner-only table (provider_profiles is public).
type ProviderVerificationRequestRow = {
  provider_id: string;
  requested_at: string | null;
  rejection_reason: string | null;
};

function fromProviderProfileRow(
  row: ProviderProfileRow,
  verificationRequest?: ProviderVerificationRequestRow | null,
): ProviderProfile {
  return {
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    specialty: row.specialty,
    areas: row.areas,
    experience: row.experience,
    about: row.about,
    photoUrl: row.photo_url ?? undefined,
    certificates: row.certificates,
    portfolio: row.portfolio,
    sqmPrices: row.sqm_prices,
    verificationStatus: row.verification_status,
    verificationRequestedAt: verificationRequest?.requested_at ?? null,
    verificationRejectionReason: verificationRequest?.rejection_reason ?? null,
  };
}

// Experience option id → representative years (for sorting/display).
const EXPERIENCE_YEARS: Record<string, number> = { lt1: 0, '1-2': 1, '3-5': 3, '6-10': 6, '10plus': 10 };

// get_provider_stats() row.
type ProviderStatsRow = { provider_id: string; avg_rating: number; review_count: number; completed_jobs: number };

// provider_profiles row (+ stats) → public directory Provider.
function fromProviderProfileRowToPublicProvider(row: ProviderProfileRow, stats?: ProviderStatsRow): Provider {
  const firstName = row.first_name ?? '';
  const lastName = row.last_name ?? '';
  const name = `${firstName} ${lastName}`.trim();
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const sqmValues = Object.values(row.sqm_prices);
  const specialtyId = row.specialty[0]?.id ?? '';
  return {
    id: row.id,
    name,
    category: specialtyId,
    categories: row.specialty
      .filter((s) => !s.id.startsWith('custom:'))
      .map((s) => s.id),
    years: row.experience ? (EXPERIENCE_YEARS[row.experience] ?? 0) : 0,
    rating: stats?.avg_rating ?? 0,
    reviews: stats?.review_count ?? 0,
    location: row.areas[0] ?? '',
    areas: row.areas,
    jobs: stats?.completed_jobs ?? 0,
    verified: row.verification_status === 'verified',
    verificationStatus: row.verification_status,
    online: row.is_available,
    initials,
    color: '#2563EB',
    bio: row.about,
    skills: [],
    certificates: row.certificates,
    portfolio: row.portfolio,
    sqmPrice: sqmValues[0],
    specialties: row.specialty.map((s) => s.label),
    photoUrl: row.photo_url ?? undefined,
  };
}

const DEFAULT_CUSTOMER_PROFILE: CustomerProfile = {
  firstName: '',
  lastName: '',
  email: '',
  defaultAddress: '',
  phone: '',
  entrance: '',
  apartment: '',
  doorCode: '',
  isPrivateHouse: false,
};

const DEFAULT_PROVIDER_PROFILE: ProviderProfile = {
  firstName: '',
  lastName: '',
  specialty: [],
  areas: [],
  experience: null,
  about: '',
  certificates: [],
  portfolio: [],
  sqmPrices: {},
  verificationStatus: 'unverified',
  verificationRequestedAt: null,
  verificationRejectionReason: null,
};

// Synchronous in-memory copy behind the profile Contexts (they keep the reactive state).
let customerProfile: CustomerProfile = { ...DEFAULT_CUSTOMER_PROFILE };
let providerProfile: ProviderProfile = { ...DEFAULT_PROVIDER_PROFILE };

export const userService = {
  getCustomerProfile: (): CustomerProfile => customerProfile,
  updateCustomerProfile: (patch: Partial<CustomerProfile>): CustomerProfile => {
    customerProfile = { ...customerProfile, ...patch };
    return customerProfile;
  },
  getProviderProfile: (): ProviderProfile => providerProfile,
  updateProviderProfile: (patch: Partial<ProviderProfile>): ProviderProfile => {
    providerProfile = { ...providerProfile, ...patch };
    return providerProfile;
  },
  // suspended/suspensionReason are set only by the admin RPC.
  async createUserRecord(uid: string, record: Omit<UserRecord, 'suspended' | 'suspensionReason'>): Promise<void> {
    const { error } = await supabase.from('users').insert({
      id: uid,
      role: record.role,
      first_name: record.firstName,
      last_name: record.lastName,
      email: record.email,
      default_address: record.defaultAddress,
      phone: record.phone,
      entrance: record.entrance,
      apartment: record.apartment,
      door_code: record.doorCode,
      is_private_house: record.isPrivateHouse,
    });
    if (error) throw error;
  },
  async getUserRecord(uid: string): Promise<UserRecord | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return fromRow(data as UserRow);
  },
  async updateUserRecord(uid: string, patch: Partial<UserRecord>): Promise<void> {
    const row: Partial<UserRow> = {};
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.lastName !== undefined) row.last_name = patch.lastName;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.defaultAddress !== undefined) row.default_address = patch.defaultAddress;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.entrance !== undefined) row.entrance = patch.entrance;
    if (patch.apartment !== undefined) row.apartment = patch.apartment;
    if (patch.doorCode !== undefined) row.door_code = patch.doorCode;
    if (patch.isPrivateHouse !== undefined) row.is_private_house = patch.isPrivateHouse;
    const { error } = await supabase.from('users').update(row).eq('id', uid);
    if (error) throw error;
  },

  async getProviderProfileRecord(uid: string): Promise<ProviderProfile | null> {
    // Always the caller's own profile, so owner-only RLS allows both reads.
    const [{ data, error }, verificationResult] = await Promise.all([
      supabase.from('provider_profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('provider_verification_requests').select('*').eq('provider_id', uid).maybeSingle(),
    ]);
    if (error) throw error;
    if (!data) return null;
    const verificationRequest = !verificationResult.error
      ? (verificationResult.data as ProviderVerificationRequestRow | null)
      : null;
    return fromProviderProfileRow(data as ProviderProfileRow, verificationRequest);
  },
  async upsertProviderProfileRecord(uid: string, record: ProviderProfile): Promise<void> {
    // Not upsert: INSERT … ON CONFLICT DO UPDATE is denied under this table's
    // column-scoped UPDATE grant. Plain UPDATE first, INSERT if no row was touched.
    const payload = {
      first_name: record.firstName,
      last_name: record.lastName,
      specialty: record.specialty,
      areas: record.areas,
      experience: record.experience,
      about: record.about,
      photo_url: record.photoUrl ?? null,
      certificates: record.certificates,
      portfolio: record.portfolio,
      sqm_prices: record.sqmPrices,
    };
    const { data: updated, error: updateError } = await supabase
      .from('provider_profiles')
      .update(payload)
      .eq('id', uid)
      .select('id');
    if (updateError) throw updateError;
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from('provider_profiles').insert({ id: uid, ...payload });
      if (insertError) throw insertError;
    }
  },
  // Public provider directory.
  async listRealProviders(): Promise<Provider[]> {
    const [{ data, error }, statsResult] = await Promise.all([
      supabase.from('provider_profiles').select('*'),
      supabase.rpc('get_provider_stats'),
    ]);
    if (error) throw error;
    const statsMap = new Map<string, ProviderStatsRow>();
    if (!statsResult.error) {
      (statsResult.data as ProviderStatsRow[]).forEach((s) => statsMap.set(s.provider_id, s));
    }
    return (data as ProviderProfileRow[]).map((row) => fromProviderProfileRowToPublicProvider(row, statsMap.get(row.id)));
  },
  async getRealProviderById(id: string): Promise<Provider | null> {
    const [{ data, error }, statsResult] = await Promise.all([
      supabase.from('provider_profiles').select('*').eq('id', id).maybeSingle(),
      supabase.rpc('get_provider_stats', { p_provider_id: id }),
    ]);
    if (error) throw error;
    if (!data) return null;
    const stats = !statsResult.error ? (statsResult.data as ProviderStatsRow[] | null)?.[0] : undefined;
    return fromProviderProfileRowToPublicProvider(data as ProviderProfileRow, stats);
  },
  // Batched by ids (one profiles query + one stats call), avoids N+1.
  async getRealProvidersByIds(ids: string[]): Promise<Provider[]> {
    if (ids.length === 0) return [];
    const [{ data, error }, statsResult] = await Promise.all([
      supabase.from('provider_profiles').select('*').in('id', ids),
      supabase.rpc('get_provider_stats'),
    ]);
    if (error) throw error;
    const statsMap = new Map<string, ProviderStatsRow>();
    if (!statsResult.error) {
      (statsResult.data as ProviderStatsRow[]).forEach((s) => statsMap.set(s.provider_id, s));
    }
    return (data as ProviderProfileRow[]).map((row) => fromProviderProfileRowToPublicProvider(row, statsMap.get(row.id)));
  },

  // Availability toggle on its own, so flipping it doesn't rewrite the whole profile.
  async getProviderAvailability(uid: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('provider_profiles')
      .select('is_available')
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    return (data as { is_available: boolean } | null)?.is_available ?? true;
  },
  async setProviderAvailability(uid: string, value: boolean): Promise<void> {
    const { error } = await supabase.from('provider_profiles').update({ is_available: value }).eq('id', uid);
    if (error) throw error;
  },

  // unverified/rejected → pending. Upload the selfie first (storageService.uploadPrivateVerificationSelfie).
  async requestProviderVerification(selfiePath: string): Promise<void> {
    const { error } = await supabase.rpc('request_provider_verification', { p_selfie_path: selfiePath });
    if (error) throw error;
  },
};
