import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { authService } from '../services/authService';
import { categoryService } from '../services/categoryService';
import { loadRankingConfig } from '../services/rankingConfigService';
import { loadSignedInUser } from '../utils/signInSession';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RoleSelectScreen } from '../screens/RoleSelectScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RegisterVerifyEmailScreen } from '../screens/RegisterVerifyEmailScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ForgotPasswordVerifyScreen } from '../screens/ForgotPasswordVerifyScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { SocialCompleteScreen } from '../screens/SocialCompleteScreen';
import { PhoneRegisterScreen } from '../screens/PhoneRegisterScreen';
import { PhoneRegisterVerifyScreen } from '../screens/PhoneRegisterVerifyScreen';
import { PhoneLoginScreen } from '../screens/PhoneLoginScreen';
import { PhoneForgotPasswordScreen } from '../screens/PhoneForgotPasswordScreen';
import { PhoneForgotPasswordVerifyScreen } from '../screens/PhoneForgotPasswordVerifyScreen';
import { CustomerSetupScreen } from '../screens/CustomerSetupScreen';
import { ProviderSetupScreen } from '../screens/ProviderSetupScreen';
import { RegistrationSuccessScreen } from '../screens/RegistrationSuccessScreen';
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
import { ViewProviderProfileScreen } from '../screens/ViewProviderProfileScreen';
import { SavedProvidersScreen } from '../screens/SavedProvidersScreen';
import { RatingScreen } from '../screens/RatingScreen';
import { CustomerCategoriesScreen } from '../screens/CustomerCategoriesScreen';
import { CustomerCategoryScreen } from '../screens/CustomerCategoryScreen';
import { CustomerProviderListScreen } from '../screens/CustomerProviderListScreen';
import { RegionAreaPickerScreen } from '../screens/RegionAreaPickerScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type BootRoute = 'Welcome' | 'CustomerHome' | 'ProviderHome' | 'ProviderSetup';

// Don't render the stack until the saved session is restored — then start
// directly on the right screen (no Welcome flash).
export function RootNavigator() {
  const [booting, setBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState<BootRoute>('Welcome');
  const { setProfile: setCustomerProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  // Warm up categories and ranking config early; both fall back to static values offline.
  useEffect(() => {
    categoryService.listCategories().catch(() => {});
    loadRankingConfig();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let route: BootRoute = 'Welcome';
      try {
        const user = await authService.waitForSession();
        if (user) {
          const result = await loadSignedInUser(user.uid, setCustomerProfile, setProviderProfile);
          if ('route' in result) route = result.route;
          else if (result.suspended) Alert.alert('ანგარიში შეჩერებულია', result.error);
        }
      } catch {
        // Error on boot → Welcome.
        route = 'Welcome';
      } finally {
        if (!cancelled) {
          setInitialRoute(route);
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount only: the Context setters aren't memoized, so listing them would loop.
  }, []);

  if (booting) {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }} initialRouteName={initialRoute}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RegisterVerifyEmail" component={RegisterVerifyEmailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ForgotPasswordVerify" component={ForgotPasswordVerifyScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="SocialComplete" component={SocialCompleteScreen} />
      <Stack.Screen name="PhoneRegister" component={PhoneRegisterScreen} />
      <Stack.Screen name="PhoneRegisterVerify" component={PhoneRegisterVerifyScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="PhoneForgotPassword" component={PhoneForgotPasswordScreen} />
      <Stack.Screen name="PhoneForgotPasswordVerify" component={PhoneForgotPasswordVerifyScreen} />
      <Stack.Screen name="CustomerSetup" component={CustomerSetupScreen} />
      <Stack.Screen name="ProviderSetup" component={ProviderSetupScreen} />
      <Stack.Screen
        name="RegistrationSuccess"
        component={RegistrationSuccessScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      {/* These routes host the tab navigators. */}
      <Stack.Screen name="CustomerHome" component={CustomerTabs} options={{ animation: 'fade' }} />
      <Stack.Screen name="ProviderHome" component={ProviderTabs} options={{ animation: 'fade' }} />
      <Stack.Screen name="ProviderJobDetail" component={ProviderJobDetailScreen} />
      <Stack.Screen name="ProviderJobFeed" component={ProviderJobFeedScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CustomerJobDetail" component={CustomerJobDetailScreen} />
      <Stack.Screen name="ChatConversation" component={ChatConversationScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="CustomerEditProfile" component={CustomerEditProfileScreen} />
      <Stack.Screen name="ProviderEditProfile" component={ProviderEditProfileScreen} />
      <Stack.Screen name="ProviderServiceAreas" component={ProviderServiceAreasScreen} />
      <Stack.Screen name="ProviderCompletedJobs" component={ProviderCompletedJobsScreen} />
      <Stack.Screen name="ProviderReviews" component={ProviderReviewsScreen} />
      <Stack.Screen name="ViewProviderProfile" component={ViewProviderProfileScreen} />
      <Stack.Screen name="SavedProviders" component={SavedProvidersScreen} />
      <Stack.Screen name="RatingScreen" component={RatingScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="CustomerCategories" component={CustomerCategoriesScreen} />
      <Stack.Screen name="CustomerCategory" component={CustomerCategoryScreen} />
      <Stack.Screen name="CustomerProviderList" component={CustomerProviderListScreen} />
      <Stack.Screen name="RegionAreaPicker" component={RegionAreaPickerScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
