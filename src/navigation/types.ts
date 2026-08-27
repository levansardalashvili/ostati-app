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
  CustomerJobs: undefined;
  ViewProviderProfile: { id: string };
  RatingScreen: {
    jobId: string;
    providerName: string;
    providerInitials: string;
    providerColor: string;
    onRate?: (data: RatingData) => void;
  };
};

// Bottom Tab-ების route-ები (Home/ჩატები/პროფილი) — თითო tab navigator
// როლის მიხედვით, RootStack-ის "CustomerHome"/"ProviderHome" route-ების
// ქვეშ ჩალაგებული (product-spec.md: "Bottom navigation, 3 ჩანართი").
export type CustomerTabParamList = {
  Home: undefined;
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
