import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { PushNotificationsBootstrap } from './src/components/PushNotificationsBootstrap';
import { colors } from './src/theme';
import { CustomerProfileProvider } from './src/state/CustomerProfileContext';
import { FavoriteProvidersProvider } from './src/state/FavoriteProvidersContext';
import { JobStatusProvider } from './src/state/JobStatusContext';
import { ProviderProfileProvider } from './src/state/ProviderProfileContext';

// Instagram-style floating tab bar fix — the root previously had no
// explicit background, so any pixel the JS tree didn't paint (the gap
// around the floating pill, created by its marginHorizontal/marginBottom)
// fell through to the native Android window background, which showed as a
// mismatched cream/warm tone instead of the app's own background.
const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <CustomerProfileProvider>
          <FavoriteProvidersProvider>
            <ProviderProfileProvider>
              <JobStatusProvider>
                <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                  <RootNavigator />
                  <PushNotificationsBootstrap />
                  <StatusBar style="dark" />
                </NavigationContainer>
              </JobStatusProvider>
            </ProviderProfileProvider>
          </FavoriteProvidersProvider>
        </CustomerProfileProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
