import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { pushTokenService } from './pushTokenService';
import type { Role } from '../types/user';

export type EmailCredentials = { email: string; password: string };
export type RegisterInput = EmailCredentials & { role: Role };
// appleFullName: Apple returns the name only on the very first sign-in, so it is passed along from here.
export type AuthResult = {
  uid: string;
  email: string | null;
  appleFullName?: { givenName: string | null; familyName: string | null } | null;
  // true when signUp returned no session ("Confirm email" on) — go to the OTP screen.
  needsEmailVerification?: boolean;
};

export type AppUser = { uid: string; email: string | null; phone: string | null; displayName: string | null };

// Web OAuth client id — must also be set in Supabase → Auth → Providers → Google (token audience).
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
  return { uid: user.id, email: user.email ?? null, phone: user.phone ?? null, displayName };
}

function toAuthResult(user: SupabaseUser): AuthResult {
  return { uid: user.id, email: user.email ?? null };
}

// Supabase has no synchronous "current user" getter; screens read it during
// render, so keep a cache updated by onAuthStateChange and after each auth call.
let cachedUser: SupabaseUser | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
});
// Resolves once the persisted session is restored (RootNavigator waits for it).
const sessionReadyPromise: Promise<AppUser | null> = supabase.auth
  .getSession()
  .then(({ data }) => {
    cachedUser = data.session?.user ?? null;
    return cachedUser ? toAppUser(cachedUser) : null;
  })
  .catch(() => null);

// Supabase error text → Georgian.
const ERROR_MESSAGES: Record<string, string> = {
  'User already registered': 'ეს ელ. ფოსტა უკვე დარეგისტრირებულია.',
  'Invalid login credentials': 'შეყვანილი მონაცემები არასწორია.',
  'Email not confirmed': 'ჯერ დაადასტურე ელ. ფოსტა — შემოწმდი ინბოქსი.',
  'Password should be at least 6 characters': 'პაროლი ძალიან მარტივია — აირჩიე უფრო საიმედო პაროლი.',
  'Unable to validate email address: invalid format': 'შეიყვანე სწორი ელ. ფოსტა.',
  'New password should be different from the old password.': 'ახალი პაროლი ძველისგან განსხვავებული უნდა იყოს.',
  // Phone OTP errors — not verified live yet (SMS is off); unknown ones fall back to the generic text.
  'For security purposes, you can only request this after 60 seconds.':
    'ძალიან ხშირად სცადე — დაელოდე და თავიდან სცადე.',
  'Token has expired or is invalid': 'კოდი არასწორია ან ვადაგასულია — სცადე თავიდან.',
  'Invalid token': 'კოდი არასწორია — გადაამოწმე და სცადე თავიდან.',
  'Unable to validate phone number: invalid format': 'შეიყვანე სწორი ტელეფონის ნომერი.',
  'Signups not allowed for this instance': 'რეგისტრაცია ამ მეთოდით ამჟამად დახურულია.',
  'Signups not allowed for otp': 'ამ ელფოსტით/ნომრით ანგარიში ვერ მოიძებნა.',
  'email rate limit exceeded': 'ელ. ფოსტების გაგზავნის ლიმიტი ამოიწურა — სცადე რამდენიმე წუთში.',
};

export function getAuthErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message;
  if (message && ERROR_MESSAGES[message]) return ERROR_MESSAGES[message];
  return 'დაფიქსირდა შეცდომა. სცადე თავიდან.';
}

export const authService = {
  async registerWithEmail({ email, password }: RegisterInput): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('რეგისტრაცია ვერ დასრულდა.');
    // No session = email not confirmed yet; caching that user would look signed in with no token.
    if (data.session) cachedUser = data.user;
    return { ...toAuthResult(data.user), needsEmailVerification: !data.session };
  },
  async signInWithEmail({ email, password }: EmailCredentials): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  async signInWithGoogle(): Promise<AuthResult> {
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
  // iOS only (also guarded in the UI with isAvailableAsync).
  async signInWithApple(): Promise<AuthResult> {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple-ით შესვლა მხოლოდ iOS-ზეა ხელმისაწვდომი.');
    }
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple Sign-In გაუქმდა.');
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
    cachedUser = data.user;
    // Best-effort backup of the name; SocialCompleteScreen uses the returned value.
    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const fullName = `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim();
      supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
    }
    return {
      ...toAuthResult(data.user),
      appleFullName: credential.fullName
        ? { givenName: credential.fullName.givenName, familyName: credential.fullName.familyName }
        : null,
    };
  },
  // Phone OTP for sign-up and sign-in. `phone` must already be E.164 (+995…).
  async sendPhoneOtp(phone: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  },
  // shouldCreateUser: false — a reset request must never create an empty account.
  async sendPhoneOtpForReset(phone: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    if (error) throw error;
  },
  async verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    if (!data.user) throw new Error('ვერიფიკაცია ვერ დასრულდა.');
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  // Email OTP (6-digit code); verifying it creates a session.
  async sendEmailOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw error;
  },
  async verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    if (!data.user) throw new Error('ვერიფიკაცია ვერ დასრულდა.');
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  // Sign-up confirmation code. type 'signup' differs from verifyEmailOtp's 'email' —
  // separate OTP kinds in Supabase.
  async verifyRegistrationOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
    if (!data.user) throw new Error('ვერიფიკაცია ვერ დასრულდა.');
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  // Resends the pending sign-up code (never creates an account).
  async resendRegistrationOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },
  // Phone + password (set once at sign-up), so login needs no SMS.
  async signInWithPhonePassword(phone: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error) throw error;
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  // Sets a password on a session just verified by OTP (sign-up or reset) — no old password needed.
  async setNewPassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
  // Re-authenticates with the current password first (Supabase's
  // updateUser() itself does not verify it — only the active session is
  // required), then changes it. Throws on a wrong current password
  // (same 'Invalid login credentials' as signInWithEmail) or if there is
  // no signed-in user with an email (e.g. a Google-only account).
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const email = cachedUser?.email;
    if (!email) throw new Error('ვერ მოიძებნა აქტიური სესია — თავიდან შედი ანგარიშში.');
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) throw reauthError;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
  async signOut(): Promise<void> {
    // Deactivate the push token while auth.uid() still exists; never blocks logout.
    await pushTokenService.deactivateCurrentToken().catch(() => {});
    await supabase.auth.signOut();
    cachedUser = null;
    // Clear Google's own session too, or the next Google sign-in skips the account picker.
    try {
      await GoogleSignin.signOut();
    } catch {
    }
  },
  // ანგარიშის სამუდამო წაშლა (delete_my_account RPC, 0095). ACTIVE_JOBS შეცდომას აგდებს, თუ მიმდინარე სამუშაო აქვს.
  async deleteAccount(): Promise<void> {
    const uid = cachedUser?.id;
    if (!uid) throw new Error('Authentication required');
    // ჯერ შემოწმება (აქტიური სამუშაოები და ა.შ.) — უარის შემთხვევაში ფაილები არ უნდა წაიშალოს
    const check = await supabase.rpc('can_delete_my_account');
    if (check.error) throw check.error;
    // ფაილების გასუფთავება — best-effort, სანამ სესია ცოცხალია (RPC-ის შემდეგ ვეღარ ვიქნებით
    // ავტორიზებულები). private-media-ს ფაილებს Edge Function შლის (SQL-ით storage ობიექტები არ იშლება).
    await supabase.functions.invoke('delete-account-files').catch(() => {});
    const targets: [string, string][] = [
      ...(['profile', 'certificate', 'portfolio', 'rating'] as const).map((k): [string, string] => ['user-media', `${k}/${uid}`]),
      ['job-photos', uid],
    ];
    for (const [bucket, folder] of targets) {
      try {
        const { data } = await supabase.storage.from(bucket).list(folder);
        if (data?.length) await supabase.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
      } catch {
        // საცავის გასუფთავება არ უნდა ბლოკავდეს წაშლას
      }
    }
    await pushTokenService.deactivateCurrentToken().catch(() => {});
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    cachedUser = null;
    // ანგარიში აღარ არსებობს — სესიას მხოლოდ ლოკალურად ვასუფთავებთ (სერვერზე გასვლა ვეღარ შედგება)
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    try {
      await GoogleSignin.signOut();
    } catch {
      // Google არასდროს გამოგვიყენებია — უვნებელია
    }
  },
  getCurrentUser(): AppUser | null {
    return cachedUser ? toAppUser(cachedUser) : null;
  },
  subscribeToAuthState(callback: (user: AppUser | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? toAppUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  },
  // Resolves once the persisted session has been read — prevents a Welcome flash on cold start.
  waitForSession(): Promise<AppUser | null> {
    return sessionReadyPromise;
  },
};
