import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, User } from 'lucide-react-native';
import { ProviderHomeScreen } from '../screens/ProviderHomeScreen';
import { ChatsListScreen } from '../screens/ChatsListScreen';
import { ProviderProfileScreen } from '../screens/ProviderProfileScreen';
import { colors, radius, typography } from '../theme';
import { CHATS_LIST } from '../data/mockChats';
import type { ProviderTabParamList } from './types';

const Tab = createBottomTabNavigator<ProviderTabParamList>();

const unreadChats = CHATS_LIST.filter((c) => c.unread > 0).length;

// Bottom Navigation — Provider (product-spec.md: "Home / ჩატები / პროფილი",
// დიზაინის რეფერენსის BottomNav-ის მიხედვით)
export function ProviderTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...typography.small, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={ProviderHomeScreen}
        options={{
          tabBarLabel: 'მთავარი',
          tabBarIcon: ({ color, focused }) => <Home size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
        }}
      />
      <Tab.Screen
        name="Chats"
        options={{
          tabBarLabel: 'ჩატები',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <MessageCircle size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              {unreadChats > 0 && !focused && <View style={badgeStyle} />}
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
          tabBarIcon: ({ color, focused }) => <User size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
        }}
      />
    </Tab.Navigator>
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
