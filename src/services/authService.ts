import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { pushTokenService } from './pushTokenService';
import type { Role } from '../types/user';

export type EmailCredentials = { email: string; password: string };
export type RegisterInput = EmailCredentials & { role: Role };
// #107 — `appleFullName` მხოლოდ `signInWithApple()`-ის შედეგზეა შევსებული
// (Apple `fullName`-ს მხოლოდ ამ ერთი, პირველი ავტორიზაციის პასუხში
// აბრუნებს — არასდროს მეორედ, არც `getCurrentUser()`/`cachedUser`-იდან) —
// ყველა დანარჩენი auth მეთოდი უბრალოდ `undefined`-ს ტოვებს, non-breaking.
export type AuthResult = {
  uid: string;
  email: string | null;
  appleFullName?: { givenName: string | null; familyName: string | null } | null;
};

// FirebaseUser-ის მსუბუქი შესატყვისი — GoogleCompleteScreen-ს displayName
// სჭირდება (Google-ის სახელი/გვარის გასაყოფად), CustomerEditProfileScreen-ს
// მხოლოდ uid. Supabase-ის signInWithIdToken (Google) user_metadata-ში
// დებს Google-ის id token-ის claim-ებს (full_name/name). `phone` — #107,
// ტელეფონის OTP ანგარიშებისთვის (Supabase-ის `auth.users.phone`).
export type AppUser = { uid: string; email: string | null; phone: string | null; displayName: string | null };

export interface AuthService {
  registerWithEmail(input: RegisterInput): Promise<AuthResult>;
  signInWithEmail(credentials: EmailCredentials): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  // #107 — `signInWithGoogle()`-ის ზუსტად იგივე ნიმუშით (native identity
  // token → Supabase `signInWithIdToken`). iOS-only — `Platform.OS`-ის
  // საკუთარი დაცვაც აქვს (defensive, UI-ის `isAvailableAsync()`-გეითის
  // გვერდით), რომ სერვისმა არასდროს ჩუმად არასწორად არ იმოქმედოს, თუ
  // მომავალში ვინმემ UI-გეითი დაივიწყა.
  signInWithApple(): Promise<AuthResult>;
  // #107 — Supabase-ის Phone/SMS OTP (Twilio Verify provider). `phone`
  // ყოველთვის უკვე ნორმალიზებული E.164 (`+995...`) სტრიქონია — სერვისი
  // თავად არ ამატებს/ამოწმებს ქვეყნის კოდს (ეკრანების საქმეა, ისევე
  // როგორც `signInWithEmail` არ trim-ავს/lowercase-ავს ელფოსტას).
  // ერთი და იგივე call ემსახურება რეგისტრაციასაც და login-საც — "ახალი
  // uid-ია თუ არსებული" client-ის მხარეს დგინდება (`getUserRecord`-ით),
  // ზუსტად ისე, როგორც Google-ისთვისაც ხდება `LoginScreen`-ში.
  sendPhoneOtp(phone: string): Promise<void>;
  verifyPhoneOtp(phone: string, token: string): Promise<AuthResult>;
  // Task — დარეგისტრირებული ტელეფონის ანგარიშისთვის login ყოველ ჯერზე
  // აღარ ითხოვს ახალ SMS-კოდს — Supabase-ის `signInWithPassword` `phone`-ს
  // `email`-ის ტოლფასად იღებს. საჭიროებს, რომ ანგარიშს უკვე ჰქონდეს
  // პაროლი დაყენებული (`setPhonePassword`, რეგისტრაციისას, ერთხელ).
  signInWithPhonePassword(phone: string, password: string): Promise<AuthResult>;
  // OTP-ით ახლახან ვერიფიცირებული ტელეფონის სესიაზე პაროლის (თავიდან)
  // დაყენება — არსებული პაროლის ხელახლა-დადასტურება აქ საჭირო არაა
  // (updatePassword-ისგან განსხვავებით, სადაც ეს რეაუთენთიფიკაციაა),
  // რადგან თავად OTP-ის ვერიფიკაცია უკვე საკმარისი დამტკიცებაა ვინაობის.
  // ორი გამომძახებელი: PhoneRegisterVerifyScreen (ახალი ანგარიშისთვის,
  // პაროლი პირველად ეყენება) და PhoneForgotPasswordVerifyScreen
  // (არსებული ანგარიშისთვის, პაროლის აღდგენისას — ძველს გადაწერს).
  setPhonePassword(password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  // Re-authenticates with the current password first (Supabase's
  // updateUser() itself does not verify it — only the active session is
  // required), then changes it. Throws on a wrong current password
  // (same 'Invalid login credentials' as signInWithEmail) or if there is
  // no signed-in user with an email (e.g. a Google-only account).
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;
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
  return { uid: user.id, email: user.email ?? null, phone: user.phone ?? null, displayName };
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
  // საერთო ტექსტი Email+Password და Phone+Password login-ის ორივე
  // ფორმისთვის — Supabase ორივე შემთხვევაში იდენტურ შეცდომას აბრუნებს,
  // ამ ტექსტს კონკრეტული ველის შესახებ ინფორმაცია არ სჭირდება.
  'Invalid login credentials': 'შეყვანილი მონაცემები არასწორია.',
  'Email not confirmed': 'ჯერ დაადასტურე ელ. ფოსტა — შემოწმდი ინბოქსი.',
  'Password should be at least 6 characters': 'პაროლი ძალიან მარტივია — აირჩიე უფრო საიმედო პაროლი.',
  'Unable to validate email address: invalid format': 'შეიყვანე სწორი ელ. ფოსტა.',
  'New password should be different from the old password.': 'ახალი პაროლი ძველისგან განსხვავებული უნდა იყოს.',
  // #107 — ტელეფონის OTP-ის Twilio Verify/GoTrue შეცდომები. ეს ზუსტი
  // სტრიქონები ვერაფიცირებულია ჯერ ცოცხლად (რეალურ ტესტვას სჭირდება,
  // იხ. თანდართული გეგმის Verification-სექცია) — საუკეთესო-შეფასებული
  // მიახლოებაა; ქვემოთ fallback ტექსტი (`დაფიქსირდა შეცდომა`) მაინც
  // დაფარავს არადამთხვეულ შემთხვევებს უსაფრთხოდ.
  'For security purposes, you can only request this after 60 seconds.':
    'ძალიან ხშირად სცადე — დაელოდე და თავიდან სცადე.',
  'Token has expired or is invalid': 'კოდი არასწორია ან ვადაგასულია — სცადე თავიდან.',
  'Invalid token': 'კოდი არასწორია — გადაამოწმე და სცადე თავიდან.',
  'Unable to validate phone number: invalid format': 'შეიყვანე სწორი ტელეფონის ნომერი.',
  'Signups not allowed for this instance': 'რეგისტრაცია ამ მეთოდით ამჟამად დახურულია.',
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
  async signInWithApple() {
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
    // მომავალი სესიისთვის ბექაფად (best-effort) — AppleCompleteScreen
    // თავად credential.fullName-ს იღებს პირდაპირ ამ call-ის დაბრუნებული
    // მნიშვნელობიდან, არა აქედან.
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
  async sendPhoneOtp(phone) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  },
  async verifyPhoneOtp(phone, token) {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    if (!data.user) throw new Error('ვერიფიკაცია ვერ დასრულდა.');
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  async signInWithPhonePassword(phone, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error) throw error;
    cachedUser = data.user;
    return toAuthResult(data.user);
  },
  async setPhonePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
  async sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },
  async updatePassword(currentPassword, newPassword) {
    const email = cachedUser?.email;
    if (!email) throw new Error('ვერ მოიძებნა აქტიური სესია — თავიდან შედი ანგარიშში.');
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) throw reauthError;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
  async signOut() {
    // Push token-ის deactivation ხდება სესიის დახურვამდე — RPC-ს (0037)
    // `auth.uid()` სჭირდება, რომელიც `supabase.auth.signOut()`-ის შემდეგ
    // აღარ არსებობს. ჩავარდნაზეც (ქსელი/RPC error) logout მაინც
    // გრძელდება — token-ის cleanup best-effort-ია, არასდროს არ ბლოკავს
    // გასვლას.
    await pushTokenService.deactivateCurrentToken().catch(() => {});
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
