import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FilePlus2, Home, MessageCircle, User } from 'lucide-react-native';
import { CustomerHomeScreen } from '../screens/CustomerHomeScreen';
import { CustomerJobsScreen } from '../screens/CustomerJobsScreen';
import { ChatsListScreen } from '../screens/ChatsListScreen';
import { CustomerProfileScreen } from '../screens/CustomerProfileScreen';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { PopBadge } from '../components/PopBadge';
import { colors, radius } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { TabBarScrollProvider } from '../state/TabBarScrollContext';
import type { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

// Bottom Navigation — Customer (product-spec.md-ის საწყისი "Home / ჩატები /
// პროფილი" 3 ჩანართი გაფართოვდა "განცხადებები" ჩანართით — ეს ყოფილი
// root-stack "CustomerJobs" ("ჩემი მოთხოვნები") ეკრანია, ახლა ტაბის სახით,
// პლუს ახალი განცხადების დამატების ღილაკი მის header-ში — მომხმარებლის
// მოთხოვნით, ცალკე "მოთხოვნის გამოქვეყნება"-ზე გადამისამართებადი ცარიელი
// ტაბის ნაცვლად).
export function CustomerTabs() {
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    return chatService.subscribeToUnreadCount(uid, 'customer', setUnreadChats);
  }, []);

  return (
    // Task — scroll-ზე დაფუძნებული ოდნავ-დიდდება/პატარავდება ეფექტი
    // (Instagram-ის მსგავსი) — TabBarScrollProvider-ს (`FloatingTabBar`-თან
    // ერთად) მთელი ტაბ-ნავიგატორისთვის ერთი გაზიარებული `barScale`
    // მდგომარეობა გააჩნია, რომელსაც root-ეკრანების ScrollView-ები
    // (`useTabBarScroll().handleScroll`) ავსებენ.
    <TabBarScrollProvider>
      <Tab.Navigator
        // Task — ProviderTabs.tsx-ის იგივე ფიქსი — default `backBehavior`
        // ('firstRoute') ყოველთვის Home-ზე აბრუნებდა "უკან"-ს, არა
        // ბოლოს ნანახ ტაბზე.
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
        component={CustomerHomeScreen}
        options={{
          tabBarLabel: 'მთავარი',
          tabBarIcon: ({ color, focused }) => <Home size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
        }}
      />
      <Tab.Screen
        name="MyJobsTab"
        component={CustomerJobsScreen}
        options={{
          tabBarLabel: 'განცხადებები',
          tabBarIcon: ({ color, focused }) => <FilePlus2 size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />,
        }}
      />
      <Tab.Screen
        name="Chats"
        options={{
          tabBarLabel: 'ჩატები',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <MessageCircle size={23} color={color} strokeWidth={focused ? 2.4 : 1.8} />
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
