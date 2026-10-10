import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Home, MessageCircle, User } from 'lucide-react-native';
import { ProviderHomeScreen } from '../screens/ProviderHomeScreen';
import { ProviderMyJobsScreen } from '../screens/ProviderMyJobsScreen';
import { ChatsListScreen } from '../screens/ChatsListScreen';
import { ProviderProfileScreen } from '../screens/ProviderProfileScreen';
import { AnimatedTabIcon } from '../components/AnimatedTabIcon';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { PopBadge } from '../components/PopBadge';
import { colors, radius } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { TabBarScrollProvider } from '../state/TabBarScrollContext';
import type { ProviderTabParamList } from './types';

const Tab = createBottomTabNavigator<ProviderTabParamList>();

// Provider tabs: Home / my jobs / chats / profile. Same bar setup as CustomerTabs.
export function ProviderTabs() {
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    return chatService.subscribeToUnreadCount(uid, 'provider', setUnreadChats);
  }, []);

  return (
    <TabBarScrollProvider>
      <Tab.Navigator
        backBehavior="history"
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarShowLabel: false,
          tabBarStyle: {
            marginHorizontal: 16,
            marginBottom: 12,
            paddingHorizontal: 8,
            paddingTop: 0,
            paddingBottom: 0,
            backgroundColor: colors.card,
            borderRadius: radius.full,
            borderTopWidth: 0,
            height: 56,
            elevation: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
          },
          tabBarItemStyle: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarIconStyle: {
            height: '100%',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={ProviderHomeScreen}
          options={{
            tabBarLabel: 'მთავარი',
            tabBarAccessibilityLabel: 'მთავარი',
            tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Home size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </AnimatedTabIcon>
          ),
          }}
        />
        <Tab.Screen
          name="MyJobsTab"
          component={ProviderMyJobsScreen}
          options={{
            tabBarLabel: 'სამუშაოები',
            tabBarAccessibilityLabel: 'სამუშაოები',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon focused={focused}>
                <ClipboardList size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              </AnimatedTabIcon>
            ),
          }}
        />
        <Tab.Screen
          name="Chats"
          options={{
            tabBarLabel: 'ჩატები',
            tabBarAccessibilityLabel: 'ჩატები',
            tabBarIcon: ({ color, focused }) => (
              <View>
                <AnimatedTabIcon focused={focused}>
                  <MessageCircle size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
                </AnimatedTabIcon>
                {unreadChats > 0 && !focused && <PopBadge style={badgeStyle} />}
              </View>
            ),
          }}
        >
          {(props) => <ChatsListScreen {...props} role="provider" />}
        </Tab.Screen>
        <Tab.Screen
          name="Profile"
          component={ProviderProfileScreen}
          options={{
            tabBarLabel: 'პროფილი',
            tabBarAccessibilityLabel: 'პროფილი',
            tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <User size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </AnimatedTabIcon>
          ),
          }}
        />
      </Tab.Navigator>
    </TabBarScrollProvider>
  );
}

const badgeStyle = {
  position: 'absolute' as const,
  top: -2,
  right: -4,
  width: 8,
  height: 8,
  borderRadius: radius.full,
  backgroundColor: colors.destructive,
};
