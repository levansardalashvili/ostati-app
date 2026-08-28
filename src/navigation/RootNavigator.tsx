import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RoleSelectScreen } from '../screens/RoleSelectScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { GoogleCompleteScreen } from '../screens/GoogleCompleteScreen';
import { CustomerSetupScreen } from '../screens/CustomerSetupScreen';
import { ProviderSetupScreen } from '../screens/ProviderSetupScreen';
import { CustomerTabs } from './CustomerTabs';
import { ProviderTabs } from './ProviderTabs';
import { ProviderJobDetailScreen } from '../screens/ProviderJobDetailScreen';
import { ProviderJobFeedScreen } from '../screens/ProviderJobFeedScreen';
import { PostJobScreen } from '../screens/PostJobScreen';
import { CustomerJobDetailScreen } from '../screens/CustomerJobDetailScreen';
import { ChatConversationScreen } from '../screens/ChatConversationScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { ProfileSettingsScreen } from '../screens/ProfileSettingsScreen';
import { CustomerEditProfileScreen } from '../screens/CustomerEditProfileScreen';
import { ProviderEditProfileScreen } from '../screens/ProviderEditProfileScreen';
import { ProviderServiceAreasScreen } from '../screens/ProviderServiceAreasScreen';
import { ProviderCompletedJobsScreen } from '../screens/ProviderCompletedJobsScreen';
import { ProviderReviewsScreen } from '../screens/ProviderReviewsScreen';
import { ProviderMyJobsScreen } from '../screens/ProviderMyJobsScreen';
import { ViewProviderProfileScreen } from '../screens/ViewProviderProfileScreen';
import { RatingScreen } from '../screens/RatingScreen';
import { CustomerCategoriesScreen } from '../screens/CustomerCategoriesScreen';
import { CustomerCategoryScreen } from '../screens/CustomerCategoryScreen';
import { RegionAreaPickerScreen } from '../screens/RegionAreaPickerScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="GoogleComplete" component={GoogleCompleteScreen} />
      <Stack.Screen name="CustomerSetup" component={CustomerSetupScreen} />
      <Stack.Screen name="ProviderSetup" component={ProviderSetupScreen} />
      {/* CustomerHome/ProviderHome routes render the Bottom Tab navigators
          (Home/ჩატები/პროფილი) — route names kept as-is so every existing
          navigation.reset({routes:[{name:'CustomerHome'}]}) call still works. */}
      <Stack.Screen name="CustomerHome" component={CustomerTabs} />
      <Stack.Screen name="ProviderHome" component={ProviderTabs} />
      <Stack.Screen name="ProviderJobDetail" component={ProviderJobDetailScreen} />
      <Stack.Screen name="ProviderJobFeed" component={ProviderJobFeedScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="CustomerJobDetail" component={CustomerJobDetailScreen} />
      <Stack.Screen name="ChatConversation" component={ChatConversationScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="CustomerEditProfile" component={CustomerEditProfileScreen} />
      <Stack.Screen name="ProviderEditProfile" component={ProviderEditProfileScreen} />
      <Stack.Screen name="ProviderServiceAreas" component={ProviderServiceAreasScreen} />
      <Stack.Screen name="ProviderCompletedJobs" component={ProviderCompletedJobsScreen} />
      <Stack.Screen name="ProviderReviews" component={ProviderReviewsScreen} />
      <Stack.Screen name="ProviderMyJobs" component={ProviderMyJobsScreen} />
      <Stack.Screen name="ViewProviderProfile" component={ViewProviderProfileScreen} />
      <Stack.Screen name="RatingScreen" component={RatingScreen} />
      <Stack.Screen name="CustomerCategories" component={CustomerCategoriesScreen} />
      <Stack.Screen name="CustomerCategory" component={CustomerCategoryScreen} />
      <Stack.Screen name="RegionAreaPicker" component={RegionAreaPickerScreen} />
    </Stack.Navigator>
  );
}
