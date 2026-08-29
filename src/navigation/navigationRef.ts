import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Push-tap navigation (PushNotificationsBootstrap.tsx) App.tsx-ის root-ზეა
// wired, ცალკე screen-ის საკუთარი `navigation` prop-ის გარეშე — ამიტომ
// გლობალური ref სჭირდება, App.tsx-ის <NavigationContainer ref={navigationRef}>-ზე
// მიბმული.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
