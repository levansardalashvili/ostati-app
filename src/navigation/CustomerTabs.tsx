import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, User } from 'lucide-react-native';
import { CustomerHomeScreen } from '../screens/CustomerHomeScreen';
import { ChatsListScreen } from '../screens/ChatsListScreen';
import { CustomerProfileScreen } from '../screens/CustomerProfileScreen';
import { colors, radius, typography } from '../theme';
import { CHATS_LIST } from '../data/mockChats';
import type { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

const unreadChats = CHATS_LIST.filter((c) => c.unread > 0).length;

// Bottom Navigation — Customer (product-spec.md: "Home / ჩატები / პროფილი",
// დიზაინის რეფერენსის BottomNav-ის მიხედვით)
export function CustomerTabs() {
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
        component={CustomerHomeScreen}
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
        {(props) => <ChatsListScreen {...props} role="customer" />}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        component={CustomerProfileScreen}
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
