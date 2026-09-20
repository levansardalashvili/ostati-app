import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Home, MessageCircle, User } from 'lucide-react-native';
import { ProviderHomeScreen } from '../screens/ProviderHomeScreen';
import { ProviderMyJobsScreen } from '../screens/ProviderMyJobsScreen';
import { ChatsListScreen } from '../screens/ChatsListScreen';
import { ProviderProfileScreen } from '../screens/ProviderProfileScreen';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { PopBadge } from '../components/PopBadge';
import { colors, radius } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { TabBarScrollProvider } from '../state/TabBarScrollContext';
import type { ProviderTabParamList } from './types';

const Tab = createBottomTabNavigator<ProviderTabParamList>();

// Bottom Navigation — Provider (product-spec.md-ის საწყისი "Home / ჩატები /
// პროფილი" 3 ჩანართი გაფართოვდა "სამუშაოები" ჩანართით — ეს ყოფილი
// root-stack "ProviderMyJobs" ("ჩემი სამუშაოები") ეკრანია, ახლა ტაბის
// სახით, Customer-ის "MyJobsTab"-ის იგივე ლოგიკით (CustomerTabs.tsx))
export function ProviderTabs() {
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    return chatService.subscribeToUnreadCount(uid, 'provider', setUnreadChats);
  }, []);

  return (
    // Task — CustomerTabs.tsx-ის იგივე ცვლილება: scroll-ზე დაფუძნებული
    // ოდნავ-დიდდება/პატარავდება ეფექტი (Instagram-ის მსგავსი),
    // TabBarScrollProvider + FloatingTabBar-ით.
    <TabBarScrollProvider>
      <Tab.Navigator
        // Task — default `backBehavior` ('firstRoute') ყოველთვის Home-ზე
        // აბრუნებდა "უკან"-ს (hardware back/ჟესტი) ნებისმიერი სხვა ტაბიდან,
        // მიუხედავად საიდან მოვიდა მომხმარებელი — მაგ. პროფილი →
        // "ჩემი სამუშაო" (MyJobsTab) → უკან, Home-ზე, არა პროფილზე.
        // 'history' აბრუნებს ბოლოს ნანახ ტაბზე, მოსალოდნელი ქცევა.
        backBehavior="history"
        // Task — "floating pill" ბარი, ფონის ფერი დაბრუნებულია
        // `colors.card`-ზე (წინა round-ში შეცდომით transparent გავხადე —
        // ეს app-ის ნაცრისფერ `colors.background`-ს აჩენდა bar-ის
        // მიდამოში, კონტენტის სუფთა თეთრთან შედარებით "კრემისფრად"
        // მოსჩანდა). Bar კვლავ ჩვეულებრივ flow-შია (არა
        // `position:'absolute'`, #98-შემდგომი "floating footer
        // content-ს ეფარება" ბაგის კლასის თავიდან ასაცილებლად).
        // აიქონები ცენტრირებულია `tabBarItemStyle`/`tabBarIconStyle`-ით
        // ორივე ღერძზე.
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarShowLabel: false,
          tabBarStyle: {
            marginHorizontal: 16,
            marginBottom: 12,
            paddingHorizontal: 8,
            // React Navigation-ის default ტაბ-ბარი ავტომატურად umატებს
            // `paddingBottom: insets.bottom`-ს (გესტების ზოლის
            // საკომპენსაციოდ) — ჩვენთვის ეს ორმაგდება, რადგან
            // `marginBottom: 12` უკვე ხელით სწევს მთელ pill-ს ზემოთ,
            // გესტების ზოლს მოშორებით. ეს დამატებითი padding სწორედ
            // ის იყო, რაც აიქონებს pill-ის ზედა ნახევარში აჭყლეტდა
            // (ქვემოთ დარჩენილი ცარიელი სივრცე). ორივე ცხადად 0-ზეა
            // დაყენებული, რომ 56pt სიმაღლე მთლიანად `tabBarItemStyle`-ის
            // `justifyContent:'center'`-მა დაითვალოს, თანაბრად.
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
          // Instagram-ის ნავ-ბარის იგივე თანაბარი დაშორება — `flex: 1`
          // ცხადადაა მითითებული (ნაცვლად default-ზე დაყრდნობისა), რომ
          // 4 აიქონი ყოველთვის ზუსტად თანაბრად გაინაწილოს pill-ის
          // სრულ სიგანეზე.
          tabBarItemStyle: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          },
          // ნამდვილი მიზეზი, რატომაც აიქონები pill-ის ზედა ნახევარში
          // იჭყლიტებოდა: React Navigation-ის საკუთარი `BottomTabItem`
          // (node_modules/@react-navigation/bottom-tabs) აქტიური item-ის
          // Pressable-ს შიგნით იყენებს `flexDirection:'column',
          // justifyContent:'flex-start'`-ს (`tabVerticalUiKit` style,
          // ლეიბლის ადგილის დასაჯავშნად, თუნდაც `tabBarShowLabel:false`
          // იყოს) — ეს შიდა style public props-ით არ იცვლება, ამიტომ
          // ჩვენი `tabBarItemStyle`-ის `justifyContent:'center'`-ს (ის
          // მხოლოდ გარე wrapping View-ს ეხება) გავლენა არ ჰქონდა.
          // სამაგიეროდ აიქონის wrapper (`TabBarIcon`) თავად ფიქსირებული
          // სიმაღლისაა (28px default) — `height: '100%'`-ით ვაიძულებთ
          // მთელი item-ის სიმაღლე დაიკავოს, სადაც მისი შიდა (`styles.icon`)
          // ვექტორი უკვე თავად ცენტრირებულია `alignItems/justifyContent:
          // 'center'`-ით — შედეგად აიქონი ზუსტად pill-ის ცენტრში ჯდება.
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
            tabBarIcon: ({ color, focused }) => <Home size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
          }}
        />
        <Tab.Screen
          name="MyJobsTab"
          component={ProviderMyJobsScreen}
          options={{
            tabBarLabel: 'სამუშაოები',
            tabBarAccessibilityLabel: 'სამუშაოები',
            tabBarIcon: ({ color, focused }) => (
              <ClipboardList size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
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
                <MessageCircle size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
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
            tabBarIcon: ({ color, focused }) => <User size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
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
