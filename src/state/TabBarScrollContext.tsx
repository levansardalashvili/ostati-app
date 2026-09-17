import React, { createContext, useContext, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

// Task — Instagram-ის ტიპის ქცევა: ტაბ-ბარი ოდნავ პატარავდება, როცა
// მომხმარებელი ქვემოთ ისქროლავს (მეტ სივრცეს "ათავისუფლებს" კონტენტისთვის),
// და უკან, სრულ ზომაზე ბრუნდება, როცა ისქროლავს ზემოთ ან თავშივეა.
// ეს არ არის "ბოლომდე დამალვა" (bar ყოველთვის ჩანს) — მხოლოდ მსუბუქი
// scale-ეფექტი, ზუსტად ისე, როგორც ვიდეოში იყო ნაჩვენები.
//
// მდგომარეობა (`barScale`) ერთადერთია მთელ ტაბ-ნავიგატორზე (Context,
// TabBarScrollProvider-ით გაზიარებული Customer/ProviderTabs-ის დონეზე) —
// ნებისმიერი ტაბის root-ეკრანის ScrollView-მა `useTabBarScroll().handleScroll`
// რომ თავის `onScroll`-ზე მიაბას, საკმარისია ჩართვისთვის, ცალკე
// per-screen state არ სჭირდება.
type TabBarScrollContextValue = {
  barScale: Animated.Value;
  handleScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

const FULL_SCALE = 1;
const COMPACT_SCALE = 0.86;
// მცირე ბიჯების (jitter, bounce, momentum-ის მინორი რხევები) იგნორირება —
// მხოლოდ განზრახული, თანმიმდევრული სქროლვა უნდა იწვევდეს ცვლილებას.
const DIRECTION_THRESHOLD = 6;
const TOP_THRESHOLD = 4;

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const barScale = useRef(new Animated.Value(FULL_SCALE)).current;
  const lastY = useRef(0);
  const isCompact = useRef(false);

  const animateTo = (toValue: number) => {
    Animated.timing(barScale, { toValue, duration: 160, useNativeDriver: true }).start();
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastY.current;
    lastY.current = y;

    if (y <= TOP_THRESHOLD) {
      if (isCompact.current) {
        isCompact.current = false;
        animateTo(FULL_SCALE);
      }
      return;
    }
    if (delta > DIRECTION_THRESHOLD && !isCompact.current) {
      isCompact.current = true;
      animateTo(COMPACT_SCALE);
    } else if (delta < -DIRECTION_THRESHOLD && isCompact.current) {
      isCompact.current = false;
      animateTo(FULL_SCALE);
    }
  };

  return <TabBarScrollContext.Provider value={{ barScale, handleScroll }}>{children}</TabBarScrollContext.Provider>;
}

export function useTabBarScroll() {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) throw new Error('useTabBarScroll must be used within TabBarScrollProvider');
  return ctx;
}
