import type { CustomerJob, FeedJob } from '../types/job';
import type { RatingData } from '../types/review';
import type { Role } from '../types/user';

// Re-exported for existing imports.
export type { Role };

export type RootStackParamList = {
  Welcome: undefined;
  RoleSelect: undefined;
  Register: { role: Role };
  // No password here: signUp already set it; the code only confirms the email.
  RegisterVerifyEmail: {
    role: Role;
    email: string;
    firstName: string;
    lastName: string;
    defaultAddress: string;
    entrance: string;
    apartment: string;
    doorCode: string;
    isPrivateHouse: boolean;
  };
  Login: undefined;
  ForgotPassword: undefined;
  // Password reset step 2 (code).
  ForgotPasswordVerify: { email: string };
  // Google/Apple sign-in → finish profile. Apple's name only arrives on first sign-in, hence the param.
  SocialComplete: {
    role: Role;
    provider: 'google' | 'apple';
    appleFullName?: { givenName: string | null; familyName: string | null } | null;
  };
  PhoneRegister: { role: Role };
  // Phone + password login (no SMS).
  PhoneLogin: undefined;
  PhoneRegisterVerify: {
    role: Role;
    phone: string;
    firstName: string;
    lastName: string;
    defaultAddress: string;
    entrance: string;
    apartment: string;
    doorCode: string;
    isPrivateHouse: boolean;
    // set on the new account after the code is verified
    password: string;
  };
  // Phone password reset: this → PhoneForgotPasswordVerify → ResetPassword.
  PhoneForgotPassword: undefined;
  PhoneForgotPasswordVerify: { phone: string };
  // Last reset step for both; runs on the session created by the OTP.
  ResetPassword: undefined;
  CustomerSetup: { userName: string };
  ProviderSetup: undefined;
  // Shown after setup, then continues to the right Home.
  RegistrationSuccess: { role: Role };
  CustomerHome: undefined;
  ProviderHome: undefined;
  // job: pass it when already loaded; otherwise the screen fetches by id.
  ProviderJobDetail: { id: string; mode?: 'browse' | 'selected' | 'completed'; job?: FeedJob };
  ProviderJobFeed: undefined;
  // editJob: edit a pending job (update_pending_job).
  PostJob: { editJob?: CustomerJob } | undefined;
  // job: pass it when already loaded; otherwise fetched by jobId (deep links).
  CustomerJobDetail: { jobId: string; job?: CustomerJob };
  // jobId: offers are tied to a job (missing when opened from a directory or a link
  // — then the provider's offer button is hidden). jobStatus: offers only while 'pending'.
  ChatConversation: {
    chatId: string;
    name: string;
    initials: string;
    color: string;
    role: Role;
    jobId?: string;
    jobStatus?: string;
    // first message from StartJobChatSheet, prefilled only if sending it failed
    draftMessage?: string;
  };
  Notifications: { role: Role };
  NotificationSettings: { role: Role };
  ProfileSettings: undefined;
  CustomerEditProfile: undefined;
  ProviderEditProfile: undefined;
  ProviderServiceAreas: undefined;
  ProviderCompletedJobs: undefined;
  ProviderReviews: undefined;
  ViewProviderProfile: { id: string };
  SavedProviders: undefined;
  CustomerCategories: undefined;
  CustomerCategory: { id: string };
  // "See all" providers, with category/area filters.
  CustomerProviderList: undefined;
  RegionAreaPicker: { selected: string[]; onSave: (areas: string[]) => void };
  RatingScreen: {
    jobId: string;
    providerName: string;
    providerInitials: string;
    providerColor: string;
    // without onRate (reopened unrated job) RatingScreen submits itself with this id
    providerId?: string;
    // must reject if saving failed — RatingScreen then shows the error
    onRate?: (data: RatingData) => void | Promise<void>;
  };
};

// Tab routes, nested under CustomerHome/ProviderHome.
export type CustomerTabParamList = {
  Home: undefined;
  MyJobsTab: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type ProviderTabParamList = {
  Home: undefined;
  MyJobsTab: undefined;
  Chats: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
