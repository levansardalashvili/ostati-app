import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { authService } from '../services/authService';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
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
import { ViewProviderProfileScreen } from '../screens/ViewProviderProfileScreen';
import { SavedProvidersScreen } from '../screens/SavedProvidersScreen';
import { RatingScreen } from '../screens/RatingScreen';
import { CustomerCategoriesScreen } from '../screens/CustomerCategoriesScreen';
import { CustomerCategoryScreen } from '../screens/CustomerCategoryScreen';
import { RegionAreaPickerScreen } from '../screens/RegionAreaPickerScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type BootRoute = 'Welcome' | 'CustomerHome' | 'ProviderHome';

// Task 1 — cold-start auth session restore. Supabase-ის session AsyncStorage-
// იდან აღდგება ასინქრონულად (authService.waitForSession) — მანამ, სანამ ეს
// არ დასრულდება, Stack-ს საერთოდ არ ვარენდერებთ (არა უბრალოდ "Welcome-ის
// ჩვენება, მერე reset" — ეს ერთ ფრეიმზეც კი გამოაჩენდა Welcome-ს). თუ სესია
// რეალურია, `users`-იდან role/profile იკითხება და Stack პირდაპირ სწორი
// Home-ით იწყება (initialRouteName) — ზუსტად LoginScreen-ის completeSignIn-ის
// იგივე ლოგიკა (role → Context-ის ჰიდრატაცია → სწორი Home).
export function RootNavigator() {
  const [booting, setBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState<BootRoute>('Welcome');
  const { setProfile: setCustomerProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  // Task 6 (audit) — categoryService-ის cache-ის ადრეული "warm-up",
  // session-restore-ისგან დამოუკიდებლად (booting-ს არ აყოვნებს/არ ეხება)
  // — რომ `deriveJobTitle`-ის და კატეგორიის სიების პირველივე გამომძახებლებმა
  // უკვე რეალური backend-მონაცემი დახვდეთ, არა მხოლოდ სტატიკური fallback.
  // ჩავარდნაზე (ქსელი) categoryService თავადვე vardebა სტატიკურ fallback-ზე.
  useEffect(() => {
    categoryService.listCategories().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let route: BootRoute = 'Welcome';
      try {
        const user = await authService.waitForSession();
        if (user) {
          const record = await userService.getUserRecord(user.uid);
          if (!record) {
            // Auth session არსებობს, მაგრამ users-ში ჩანაწერი არ მოიძებნა
            // (მაგ. რეგისტრაცია არასდროს დასრულებულა) — "ნახევრად
            // authenticated" state-ს არ ვტოვებთ, უსაფრთხოდ ვსვამთ.
            await authService.signOut().catch(() => {});
          } else if (record.role === 'provider') {
            setProviderProfile({ firstName: record.firstName, lastName: record.lastName });
            const providerProfile = await userService.getProviderProfileRecord(user.uid).catch(() => null);
            if (providerProfile && !cancelled) setProviderProfile(providerProfile);
            route = 'ProviderHome';
          } else {
            setCustomerProfile({
              firstName: record.firstName,
              lastName: record.lastName,
              email: record.email,
              defaultAddress: record.defaultAddress,
            });
            route = 'CustomerHome';
          }
        }
      } catch {
        // ქსელის/Supabase-ის შეცდომა ბუტზე — უსაფრთხო fallback, Welcome.
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
    // განზრახ მხოლოდ mount-ზე (ერთხელ) — ეს არის ერთჯერადი "cold start"
    // ბუტსტრეპი, არა ცოცხალი auth-listener. `setCustomerProfile`/
    // `setProviderProfile` (Context-იდან) არ არის memo-ილი — მათი
    // reference ყოველ Context re-render-ზე იცვლება, ამიტომ dependency
    // array-ში ჩასმა infinite-loop-ს გამოიწვევდა (setProfile-ის ყოველი
    // გამოძახება ახალ Context-value-ს ქმნის → ეს Component-იც re-render-
    // დება → ახალი setProfile reference → ეფექტი თავიდან ეშვება).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (booting) {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
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
      <Stack.Screen name="ViewProviderProfile" component={ViewProviderProfileScreen} />
      <Stack.Screen name="SavedProviders" component={SavedProvidersScreen} />
      <Stack.Screen name="RatingScreen" component={RatingScreen} />
      <Stack.Screen name="CustomerCategories" component={CustomerCategoriesScreen} />
      <Stack.Screen name="CustomerCategory" component={CustomerCategoryScreen} />
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
