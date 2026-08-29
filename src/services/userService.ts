import { supabase } from './supabaseClient';
import type { CustomerProfile, UserRecord } from '../types/user';
import type { Provider, ProviderProfile, VerificationStatus } from '../types/provider';

// `users` ცხრილის Postgres-ის row shape (snake_case) — UserRecord (camelCase)
// TS-ის მხარეს უცვლელი რჩება, კონვერტაცია ხდება ამ ფაილშივე, სერვისის
// საზღვარზე. იხ. supabase/README.md ცხრილის SQL-ისთვის.
type UserRow = {
  id: string;
  role: UserRecord['role'];
  first_name: string;
  last_name: string;
  email: string;
  default_address: string;
};

function fromRow(row: UserRow): UserRecord {
  return {
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    defaultAddress: row.default_address,
  };
}

// `provider_profiles` ცხრილის Postgres row shape. `first_name`/`last_name`
// **დუბლირებულია** აქაც (#60-ის მიხედვით, #53-ის თავდაპირველი "მხოლოდ
// users-ში" გადაწყვეტილების override) — საჯარო Provider დირექტორიის (#60)
// უსაფრთხო public-read-ისთვის: `users`-ს არასდროს არ შეიძლება გაეხსნას
// საჯარო SELECT (email/მისამართი შეიცავს Customer-ებისთვისაც), ამიტომ
// `provider_profiles`-ს (რომელიც არაფერს მგრძნობიარეს არ შეიცავს) ეს ორი
// ველი დაემატა, რომ დირექტორია `users`-თან join-ის გარეშე აშენდეს.
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
  // Task 3 — supabase/migrations/0025. RLS-ით client-ისთვის ჩაკეტილია
  // (owner-ს არასდროს არ შეუძლია საკუთარი თავი გაავერიფიციროს), ამიტომ
  // ეს მნიშვნელობა ყოველთვის სანდოა, საიდანაც არ უნდა წამოვიდეს.
  verification_status: VerificationStatus;
};

function fromProviderProfileRow(row: ProviderProfileRow): ProviderProfile {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    specialty: row.specialty,
    areas: row.areas,
    experience: row.experience,
    about: row.about,
    photoUrl: row.photo_url ?? undefined,
    certificates: row.certificates,
    portfolio: row.portfolio,
    sqmPrices: row.sqm_prices,
  };
}

// EXPERIENCE_OPTIONS-ის id (მაგ. '10plus') → წარმომადგენელი წლების
// რიცხვი, `Provider.years`-ისთვის (დახარისხების/ჩვენების მიზნით).
const EXPERIENCE_YEARS: Record<string, number> = { lt1: 0, '1-2': 1, '3-5': 3, '6-10': 6, '10plus': 10 };

// `provider_stats` view-ის row — `reviews`-იდან დათვლილი (avg_rating/
// review_count, #64) და `job_posts`-იდან დათვლილი (completed_jobs, #67,
// job-ის Provider-ზე რეალური "მინიჭების"/დასრულების state machine-ის
// Supabase-ზე დაკავშირების შემდეგ).
type ProviderStatsRow = { provider_id: string; avg_rating: number; review_count: number; completed_jobs: number };

// `provider_profiles`-ის row → საჯარო დირექტორიის `Provider` ობიექტი
// (#60), `stats`-ის (#64) არასავალდებულო overlay-ით. `jobs`/`online`/
// `price`/`skills` კვლავ ნაგულისხმევებზეა; `isNewProvider`/
// `weightedRating` (#42/#43) გამართულად ამუშავებენ `reviews === 0`-ს
// "ახალი ოსტატი"-დ, crash-ის გარეშე. `verified`/`verificationStatus`
// (Task 3) რეალურია — `row.verification_status`-იდან, რომელიც RLS-ით
// client-ისთვის ჩაკეტილია (0025), ამიტომ ეს ბეჯი ყოველთვის სანდო,
// backend-დან მომდინარე მონაცემია, არასდროს client-ის საკუთარი პრეტენზია.
function fromProviderProfileRowToPublicProvider(row: ProviderProfileRow, stats?: ProviderStatsRow): Provider {
  const name = `${row.first_name} ${row.last_name}`.trim();
  const initials = `${row.first_name.charAt(0)}${row.last_name.charAt(0)}`.toUpperCase();
  const sqmValues = Object.values(row.sqm_prices);
  return {
    id: row.id,
    name,
    category: row.specialty[0]?.id ?? '',
    years: row.experience ? (EXPERIENCE_YEARS[row.experience] ?? 0) : 0,
    rating: stats?.avg_rating ?? 0,
    reviews: stats?.review_count ?? 0,
    location: row.areas[0] ?? '',
    areas: row.areas,
    price: '',
    jobs: stats?.completed_jobs ?? 0,
    verified: row.verification_status === 'verified',
    verificationStatus: row.verification_status,
    online: false,
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
  firstName: 'ნინო',
  lastName: 'სულაბერიძე',
  email: 'nino.sulaberidze@gmail.com',
  defaultAddress: 'ვაკე, თბილისი',
};

const DEFAULT_PROVIDER_PROFILE: ProviderProfile = {
  firstName: 'გიორგი',
  lastName: 'ბერიძე',
  specialty: [{ id: 'plumber', label: 'სანტექნიკოსი' }],
  areas: ['ვაკე', 'საბურთალო', 'ვერა'],
  experience: '10plus',
  about: 'ვარ სანტექნიკოსი 15 წლიანი გამოცდილებით. ვასრულებ ყველა სახის სანტექნიკის სამუშაოს სწრაფად და ხარისხიანად.',
  certificates: [{ id: 1, bg: '#DBEAFE' }],
  portfolio: [
    { id: 1, bg: '#D1FAE5' },
    { id: 2, bg: '#FEF3C7' },
    { id: 3, bg: '#FCE7F3' },
  ],
  sqmPrices: {},
};

// მარტივი module-level "in-memory db" — ერთადერთი ლოკალური მომხმარებელია
// დღევანდელ დემოში (auth ჯერ არ არსებობს), ამიტომ საკმარისია React state-ის
// გარეთ. CustomerProfileContext/ProviderProfileContext კვლავ თავად ინახავენ
// რეაქტიულ ასლს (useState) და ამ სერვისის მეშვეობით კითხულობენ/წერენ —
// განზრახ სინქრონული, რომ Context-ის setState-ის timing არ შეიცვალოს.
let customerProfile: CustomerProfile = { ...DEFAULT_CUSTOMER_PROFILE };
let providerProfile: ProviderProfile = { ...DEFAULT_PROVIDER_PROFILE };

export interface UserService {
  getCustomerProfile(): CustomerProfile;
  updateCustomerProfile(patch: Partial<CustomerProfile>): CustomerProfile;
  getProviderProfile(): ProviderProfile;
  updateProviderProfile(patch: Partial<ProviderProfile>): ProviderProfile;

  // Supabase-ის `users` ცხრილი — ანგარიშის საბაზისო ჩანაწერი (role +
  // identity). Register/GoogleComplete წერს, Login კითხულობს (რომ იცოდეს
  // სად გადაიყვანოს — CustomerHome თუ ProviderHome), CustomerEditProfile
  // ცვლილებას ინახავს. ეს არის პირველი ნამდვილი (არა mock) backend
  // persistence ამ აპში — providerProfiles/jobPosts/... ჯერ არ არსებობს.
  createUserRecord(uid: string, record: UserRecord): Promise<void>;
  getUserRecord(uid: string): Promise<UserRecord | null>;
  updateUserRecord(uid: string, patch: Partial<UserRecord>): Promise<void>;

  // Supabase-ის `provider_profiles` ცხრილი — Provider-ის საკუთარი,
  // რედაქტირებადი პროფილის გაფართოება (`users`-ის მეტი: specialty, areas,
  // experience, about, ფოტო/სერთიფიკატი/portfolio, sqm ფასები). #52-ის
  // მეორე ეტაპი — `users`-ის შემდეგ. `upsert`, რადგან ProviderSetupScreen
  // პირველად ქმნის ჩანაწერს, ProviderEditProfileScreen შემდეგ ანახლებს —
  // ორივე იმავე მეთოდით მუშაობს.
  getProviderProfileRecord(uid: string): Promise<ProviderProfile | null>;
  upsertProviderProfileRecord(uid: string, record: ProviderProfile): Promise<void>;

  // საჯარო Provider დირექტორია, რეალურად Supabase-ზე (#60) — `provider_profiles`-ის
  // ყველა row-ს კითხულობს (public-read RLS, #60-ის SQL).
  listRealProviders(): Promise<Provider[]>;
  // ერთი Provider-ის პირდაპირი წაკითხვა id-ით (#71) — `listRealProviders()`-ის
  // filter-ის ნაცვლად, სადაც მხოლოდ ერთი კონკრეტული Provider-ია საჭირო
  // (ViewProviderProfileScreen-ის deep-link ან პირდაპირი id-ით გახსნა).
  getRealProviderById(id: string): Promise<Provider | null>;

  // Task 2 — Provider Home-ის ხელმისაწვდომობის toggle, `provider_profiles.is_available`-ზე
  // (მანამდე ლოკალური `useState`). ცალკე, მსუბუქი მეთოდებია (არა
  // getProviderProfileRecord/upsertProviderProfileRecord-ის ნაწილი), რომ
  // Home-ის toggle-ის ტოგვამ სრული პროფილის re-fetch/overwrite არ გამოიწვიოს.
  getProviderAvailability(uid: string): Promise<boolean>;
  setProviderAvailability(uid: string, value: boolean): Promise<void>;
}

export const userService: UserService = {
  getCustomerProfile: () => customerProfile,
  updateCustomerProfile: (patch) => {
    customerProfile = { ...customerProfile, ...patch };
    return customerProfile;
  },
  getProviderProfile: () => providerProfile,
  updateProviderProfile: (patch) => {
    providerProfile = { ...providerProfile, ...patch };
    return providerProfile;
  },
  async createUserRecord(uid, record) {
    const { error } = await supabase.from('users').insert({
      id: uid,
      role: record.role,
      first_name: record.firstName,
      last_name: record.lastName,
      email: record.email,
      default_address: record.defaultAddress,
    });
    if (error) throw error;
  },
  async getUserRecord(uid) {
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return fromRow(data as UserRow);
  },
  async updateUserRecord(uid, patch) {
    const row: Partial<UserRow> = {};
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.lastName !== undefined) row.last_name = patch.lastName;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.defaultAddress !== undefined) row.default_address = patch.defaultAddress;
    const { error } = await supabase.from('users').update(row).eq('id', uid);
    if (error) throw error;
  },

  async getProviderProfileRecord(uid) {
    const { data, error } = await supabase.from('provider_profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return fromProviderProfileRow(data as ProviderProfileRow);
  },
  async upsertProviderProfileRecord(uid, record) {
    const { error } = await supabase.from('provider_profiles').upsert({
      id: uid,
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
    });
    if (error) throw error;
  },
  async listRealProviders() {
    // Security audit — `provider_stats` VIEW ჩანაცვლდა `get_provider_stats()`
    // RPC-ით (Supabase-ის "Security Definer View" lint-გაფრთხილების
    // გასწორება, supabase/migrations/0030) — ვიწროდ განსაზღვრული ფუნქცია,
    // იგივე 4 agregირებული სვეტი, არა ღია VIEW.
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
  async getRealProviderById(id) {
    const [{ data, error }, statsResult] = await Promise.all([
      supabase.from('provider_profiles').select('*').eq('id', id).maybeSingle(),
      supabase.rpc('get_provider_stats', { p_provider_id: id }),
    ]);
    if (error) throw error;
    if (!data) return null;
    const stats = !statsResult.error ? (statsResult.data as ProviderStatsRow[] | null)?.[0] : undefined;
    return fromProviderProfileRowToPublicProvider(data as ProviderProfileRow, stats);
  },

  async getProviderAvailability(uid) {
    const { data, error } = await supabase
      .from('provider_profiles')
      .select('is_available')
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    return (data as { is_available: boolean } | null)?.is_available ?? true;
  },
  async setProviderAvailability(uid, value) {
    const { error } = await supabase.from('provider_profiles').update({ is_available: value }).eq('id', uid);
    if (error) throw error;
  },
};
