// Root stack-ის route-ების სია. ეტაპობრივად დაემატება ყველა ეკრანი
// product-spec.md-ის "ეკრანების სრული სია" მიხედვით.
import type { RatingData } from '../data/mockHomeData';

export type Role = 'customer' | 'provider';

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
  ProviderJobDetail: { id: string; mode?: 'browse' | 'selected' | 'completed' };
  ProviderJobFeed: undefined;
  PostJob: undefined;
  CustomerJobDetail: { jobId: string };
  ChatConversation: { chatId: string; name: string; initials: string; color: string; role: Role };
  Notifications: { role: Role };
  NotificationSettings: { role: Role };
  ProfileSettings: undefined;
  CustomerEditProfile: undefined;
  ProviderEditProfile: undefined;
  ProviderServiceAreas: undefined;
  ProviderCompletedJobs: undefined;
  ProviderReviews: undefined;
  ProviderMyJobs: undefined;
  ViewProviderProfile: { id: string };
  CustomerCategories: undefined;
  CustomerCategory: { id: string };
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
// "CustomerHome"/"ProviderHome" route-ების ქვეშ ჩალაგებული. Customer-ს 4
// ჩანართი აქვს (product-spec.md-ის საწყისი "3 ჩანართის" წესზე override,
// მომხმარებლის მოთხოვნით) — "MyJobsTab" არის ყოფილი root-stack "CustomerJobs"
// ეკრანი (ახლა ტაბის სახით, არა push-ით პროფილიდან — იხ. CustomerJobsScreen.tsx).
export type CustomerTabParamList = {
  Home: undefined;
  MyJobsTab: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type ProviderTabParamList = {
  Home: undefined;
  Chats: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
