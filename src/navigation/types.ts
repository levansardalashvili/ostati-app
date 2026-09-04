// Root stack-ის route-ების სია. ეტაპობრივად დაემატება ყველა ეკრანი
// product-spec.md-ის "ეკრანების სრული სია" მიხედვით.
import type { CustomerJob, FeedJob } from '../types/job';
import type { RatingData } from '../types/review';
import type { Role } from '../types/user';

// Role ახლა src/types/user.ts-შია განსაზღვრული (domain models refactor) —
// აქ რეექსპორტდება, რომ არსებული `import type { Role } from '../navigation/types'`
// import-ები ყველგან ხელუხლებელი დარჩეს.
export type { Role };

export type RootStackParamList = {
  Welcome: undefined;
  RoleSelect: undefined;
  Register: { role: Role };
  Login: undefined;
  ForgotPassword: undefined;
  GoogleComplete: { role: Role };
  CustomerSetup: { userName: string };
  ProviderSetup: undefined;
  CustomerHome: undefined;
  ProviderHome: undefined;
  // `job` — არასავალდებულო, უკვე წამოღებული FeedJob (real Supabase-ის
  // job_posts-იდან, #54 "ეტაპი B"). თუ არ არის გადაცემული, ეკრანი თავად
  // წამოიღებს (jobService.getFeedJobPostById, #71).
  ProviderJobDetail: { id: string; mode?: 'browse' | 'selected' | 'completed'; job?: FeedJob };
  ProviderJobFeed: undefined;
  PostJob: undefined;
  // `job` — არასავალდებულო, უკვე წამოღებული CustomerJob ობიექტი (real
  // Supabase-ის job_posts-იდან, #53), როცა გამომძახებელს (CustomerJobsScreen,
  // PostJobScreen) ეს უკვე ხელთ აქვს — ხელახალი fetch-ის თავიდან ასაცილებლად.
  // თუ არ არის გადაცემული, ეკრანი თავად წამოიღებს (jobService.getJobPostById,
  // #71) — notification deep-link-ებისთვის, სადაც მხოლოდ jobId ცნობილია.
  CustomerJobDetail: { jobId: string; job?: CustomerJob };
  // `jobId` — second hardening pass, item 5 (supabase/migrations/0049):
  // ჩატის სტრუქტურირებული ფასის შეთავაზება ახლა job-ზეა მიბმული
  // (`messages.job_id`), აღარ არის (customer_id, provider_id)-დან
  // inferred. Optional — Provider-ის ყველა შესვლის წერტილს (Job Feed/
  // job detail/Home) ეს ხელთ აქვს job-კონტექსტიდან; Customer-ის
  // დირექტორია-დაფუძნებული ჩატის (SavedProviders/ViewProviderProfile)
  // ან notification-deep-link-ის შესვლისას `undefined`-ია — ამ
  // შემთხვევებში (Provider-ის მხრიდან) ფასის შეთავაზების ღილაკი
  // უბრალოდ არ ჩანს (ChatConversationScreen).
  // `jobStatus` — Audit fix: the chat price-offer composer must only be
  // offered while the linked job is still negotiable (`status='pending'`,
  // before a Provider is selected) — `respond_to_chat_offer`'s own RLS/RPC
  // guard (supabase/migrations/0049/0066) already rejects any offer once
  // the job goes 'active', but the client previously kept showing the
  // Wallet button regardless, so the send would silently fail. Optional —
  // when the caller doesn't have it handy, the composer button is hidden
  // rather than risk showing a broken affordance.
  ChatConversation: { chatId: string; name: string; initials: string; color: string; role: Role; jobId?: string; jobStatus?: string };
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
  // CustomerHomeScreen-ის "ტოპ ოსტატები შენს არეალში" სექციის "ყველას
  // ნახვა" — ყველა Provider + კატეგორია/არეალის ფილტრები (Home-იდან
  // მოცილებული UI აქ ცოცხლდება).
  CustomerProviderList: undefined;
  RegionAreaPicker: { selected: string[]; onSave: (areas: string[]) => void };
  RatingScreen: {
    jobId: string;
    providerName: string;
    providerInitials: string;
    providerColor: string;
    onRate?: (data: RatingData) => void;
  };
};

// Bottom Tab-ების route-ები — თითო tab navigator როლის მიხედვით, RootStack-ის
// "CustomerHome"/"ProviderHome" route-ების ქვეშ ჩალაგებული. ორივე როლს 4
// ჩანართი აქვს (product-spec.md-ის საწყისი "3 ჩანართის" წესზე override,
// მომხმარებლის მოთხოვნით) — "MyJobsTab" ორივე მხარეს ყოფილი root-stack
// ეკრანია (Customer-ისთვის "CustomerJobs", Provider-ისთვის "ProviderMyJobs"),
// ახლა ტაბის სახით, არა push-ით პროფილიდან/Home-იდან (იხ. CustomerJobsScreen.tsx
// და ProviderMyJobsScreen.tsx).
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
