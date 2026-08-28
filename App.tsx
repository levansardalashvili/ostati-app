import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { CustomerProfileProvider } from './src/state/CustomerProfileContext';
import { FavoriteProvidersProvider } from './src/state/FavoriteProvidersContext';
import { JobStatusProvider } from './src/state/JobStatusContext';
import { ProviderProfileProvider } from './src/state/ProviderProfileContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CustomerProfileProvider>
          <FavoriteProvidersProvider>
            <ProviderProfileProvider>
              <JobStatusProvider>
                <NavigationContainer>
                  <RootNavigator />
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
