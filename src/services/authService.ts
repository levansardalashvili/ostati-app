import type { Role } from '../types/user';

export type EmailCredentials = { email: string; password: string };
export type RegisterInput = EmailCredentials & { role: Role };

export interface AuthService {
  registerWithEmail(input: RegisterInput): Promise<void>;
  signInWithEmail(credentials: EmailCredentials): Promise<void>;
  signInWithGoogle(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

// TODO: ჩანაცვლდება @react-native-firebase/auth-ის რეალური გამოძახებებით
// (createUserWithEmailAndPassword, signInWithEmailAndPassword,
// GoogleSignin + signInWithCredential, sendPasswordResetEmail, signOut).
//
// დღეს დაუყოვნებლივ resolve-დება — ხელოვნური დაყოვნება/loading-ინდიკატორი
// (setTimeout) კვლავ ეკრანების მხარეს რჩება (Register/Login/ForgotPassword/
// GoogleComplete), უცვლელი timing-ით — ეს სერვისი მხოლოდ ცვლის, ეკრანი
// ადრე ეკრანის შიგნით რას აკეთებდა inline-ად (ვალიდაცია გავლილია, "network
// call"-ის მაგივრობა), მაგრამ UI-ის დროულობას/ქცევას არ ცვლის.
export const authService: AuthService = {
  async registerWithEmail() {},
  async signInWithEmail() {},
  async signInWithGoogle() {},
  async sendPasswordReset() {},
  async signOut() {},
};
