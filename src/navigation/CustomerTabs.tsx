import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FilePlus2, Home, MessageCircle, User } from 'lucide-react-native';
import { CustomerHomeScreen } from '../screens/CustomerHomeScreen';
import { CustomerJobsScreen } from '../screens/CustomerJobsScreen';
import { ChatsListScreen } from '../screens/ChatsListScreen';
import { CustomerProfileScreen } from '../screens/CustomerProfileScreen';
import { AnimatedTabIcon } from '../components/AnimatedTabIcon';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { PopBadge } from '../components/PopBadge';
import { colors, radius } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { jobService } from '../services/jobService';
import { TabBarScrollProvider } from '../state/TabBarScrollContext';
import type { CustomerTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

// Customer tabs: Home / my jobs / chats / profile.
export function CustomerTabs() {
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    return chatService.subscribeToUnreadCount(uid, 'customer', setUnreadChats);
  }, []);

  // Rating is mandatory: a confirmed-but-unrated job reopens RatingScreen on
  // every launch / login / return to foreground until the review is sent
  // (covers app kill mid-rating and the 72h auto-confirm path).
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useEffect(() => {
    const check = () => {
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) return;
      jobService
        .getPendingRatingJob(uid)
        .then((job) => {
          if (!job) return;
          const state = navigation.getState();
          if (state?.routes[state.index]?.name === 'RatingScreen') return;
          navigation.navigate('RatingScreen', {
            jobId: job.id,
            providerId: job.providerId,
            providerName: job.providerName,
            providerInitials: job.providerName.charAt(0).toUpperCase() || 'O',
            providerColor: colors.primary,
          });
        })
        .catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [navigation]);

  return (
    // Tab bar shrinks slightly on scroll (shared state for all tab screens).
    <TabBarScrollProvider>
      <Tab.Navigator
        // Back returns to the previously viewed tab, not always Home.
        backBehavior="history"
        // Floating pill bar, solid background, in normal layout flow (not absolute — it would cover content).
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
            // Zero paddings: marginBottom already lifts the pill off the gesture bar;
            // the default inset padding pushed the icons up.
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
          // BottomTabItem aligns its content to the top (reserving label space even with labels off)
          // — a full-height icon wrapper centers the icon.
          tabBarIconStyle: {
            height: '100%',
          },
        }}
      >
      <Tab.Screen
        name="Home"
        component={CustomerHomeScreen}
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
        component={CustomerJobsScreen}
        options={{
          tabBarLabel: 'განცხადებები',
          tabBarAccessibilityLabel: 'განცხადებები',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <FilePlus2 size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
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
        {(props) => <ChatsListScreen {...props} role="customer" />}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        component={CustomerProfileScreen}
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
