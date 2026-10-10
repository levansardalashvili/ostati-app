import React, { createContext, useContext, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

// Tab bar shrinks a little while scrolling down and returns at the top (never hides).
// One shared value per tab navigator; a screen just wires handleScroll to its ScrollView.
type TabBarScrollContextValue = {
  barScale: Animated.Value;
  handleScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

const FULL_SCALE = 1;
const COMPACT_SCALE = 0.86;
// Ignore jitter/bounce.
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
