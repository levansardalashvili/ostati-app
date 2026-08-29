import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Role } from '../types/user';

export type EmailCredentials = { email: string; password: string };
export type RegisterInput = EmailCredentials & { role: Role };
export type AuthResult = { uid: string; email: string | null };

// FirebaseUser-ის მსუბუქი შესატყვისი — GoogleCompleteScreen-ს displayName
// სჭირდება (Google-ის სახელი/გვარის გასაყოფად), CustomerEditProfileScreen-ს
// მხოლოდ uid. Supabase-ის signInWithIdToken (Google) user_metadata-ში
// დებს Google-ის id token-ის claim-ებს (full_name/name).
export type AppUser = { uid: string; email: string | null; displayName: string | null };

export interface AuthService {
  registerWithEmail(input: RegisterInput): Promise<AuthResult>;
  signInWithEmail(credentials: EmailCredentials): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  getCurrentUser(): AppUser | null;
  subscribeToAuthState(callback: (user: AppUser | null) => void): () => void;
  // Cold-start session restore (Task 1) — resolves once Supabase-ის
  // persisted session (AsyncStorage) რეალურად წაკითხულია, ისე რომ
  // RootNavigator-მა Welcome-ის საწყისი render (flash) ამის დასრულებამდე
  // არ გამოაჩინოს. ერთხელ გამოითვლება (module-level promise), ყოველი
  // გამომძახებელი ერთსა და იმავე შედეგს იღებს.
  waitForSession(): Promise<AppUser | null>;
}

// Web OAuth Client ID — იგივე, რაც Firebase-ის დროს გამოვიყენეთ Google
// Sign-In-ისთვის (docs/firebase-setup.md-ის მსგავსი Google Cloud Console
// კონფიგურაცია, Supabase-ს არაფერი ეხება). Supabase-ს ცალკე სჭირდება ეს
// Client ID დარეგისტრირებული Authentication → Providers → Google-ში, რომ
// id token-ის audience-ს დაუშვას.
const GOOGLE_WEB_CLIENT_ID = '463055179499-khj88vj0ts6l2ufvaarnbdgn4f55snkj.apps.googleusercontent.com';

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error(
      'Google Sign-In ჯერ არ არის კონფიგურირებული — GOOGLE_WEB_CLIENT_ID ცარიელია authService.ts-ში.',
    );
  }
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

function toAppUser(user: SupabaseUser): AppUser {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const displayName = (meta?.full_name as string) || (meta?.name as string) || null;
  return { uid: user.id, email: user.email ?? null, displayName };
}

function toAuthResult(user: SupabaseUser): AuthResult {
  return { uid: user.id, email: user.email ?? null };
}

// ბოლოს ცნობილი მომხმარებელი, სინქრონული წვდომისთვის (getCurrentUser) —
// Supabase-ის auth-js-ს, Firebase-ისგან განსხვავებით, არ აქვს სინქრონული
// "მიმდინარე მომხმარებლის" getter (getSession/getUser ორივე Promise-ს
// აბრუნებს), მაგრამ GoogleCompleteScreen-ს სჭირდება ეს მონაცემი render-ის
// დროს, სინქრონულად (#48-ის პრინციპი — ეკრანების სტრუქტურის დაცვა). ეს
// cache ორივენაირად ივსება: onAuthStateChange listener-ით და პირდაპირ
// თითოეული წარმატებული auth call-ის შემდეგ (რომ დაბლოკვის/დაყოვნების
// გარეშე იყოს ხელმისაწვდომი მომდევნო ეკრანზე navigate-ისთანავე).
let cachedUser: SupabaseUser | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
});
// იგივე საწყისი getSession() call, უბრალოდ ახლა `sessionReadyPromise`-ადაც
// ინახება (waitForSession-ისთვის) — RootNavigator-ს სჭირდება ეს Promise,
// რომ იცოდეს ზუსტად როდის დასრულდა AsyncStorage-იდან სესიის აღდგენა.
const sessionReadyPromise: Promise<AppUser | null> = supabase.auth
  .getSession()
  .then(({ data }) => {
    cachedUser = data.session?.user ?? null;
    return cachedUser ? toAppUser(cachedUser) : null;
  })
  .catch(() => null);

// Supabase-ის შეცდომის ტექსტები ქართულ, მომხმარებლისთვის გასაგებ
// ტექსტად — ეკრანების არსებული error-banner-ების მიერ გამოსაყენებელი.
const ERROR_MESSAGES: Record<string, string> = {
  'User already registered': 'ეს ელ. ფოსტა უკვე დარეგისტრირებულია.',
  'Invalid login credentials': 'ელ. ფოსტა ან პაროლი არასწორია.',
  'Email not confirmed': 'ჯერ დაადასტურე ელ. ფოსტა — შემოწმდი ინბოქსი.',
  'Password should be at least 6 characters': 'პაროლი ძალიან მარტივია — აირჩიე უფრო საიმედო პაროლი.',
  'Unable to validate email address: invalid format': 'შეიყვანე სწორი ელ. ფოსტა.',
};

export function getAuthErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message;
  if (message && ERROR_MESSAGES[message]) return ERROR_MESSAGES[message];
  return 'დაფიქსირდა შეცდომა. სცადე თავიდან.';
}

export const authService: AuthService = {
  async registerWithEmail({ email, password }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('რეგისტრაცია ვერ დასრულდა.');
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  async signInWithEmail({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  async signInWithGoogle() {
    ensureGoogleConfigured();
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success' || !response.data.idToken) {
      throw new Error('Google Sign-In გაუქმდა.');
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });
    if (error) throw error;
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  async sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },
  async signOut() {
    await supabase.auth.signOut();
    cachedUser = null;
    // GoogleSignin-ის საკუთარი session-იც უნდა გასუფთავდეს, თორემ შემდეგი
    // "Google-ით შესვლა" იმავე ანგარიშს "ჩუმად" აბრუნებს, ანგარიშის
    // არჩევანის დიალოგის გარეშე.
    try {
      await GoogleSignin.signOut();
    } catch {
      // GoogleSignin ან არასდროს კონფიგურირებულა (მხოლოდ email/password
      // გამოყენებისას), ან უკვე გამოსული იყო — ორივე შემთხვევა უვნებელია.
    }
  },
  getCurrentUser() {
    return cachedUser ? toAppUser(cachedUser) : null;
  },
  subscribeToAuthState(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? toAppUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  },
  waitForSession() {
    return sessionReadyPromise;
  },
};
