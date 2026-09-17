import React from 'react';
import { Animated } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTabBarScroll } from '../state/TabBarScrollContext';

// Task — React Navigation-ის საკუთარ `BottomTabBar`-ს (მისი ჩვეულებრივი
// რენდერი/ქცევა/accessibility უცვლელად) მხოლოდ `scale`-ტრანსფორმაციას
// ვამატებთ, `barScale`-ზე დაფუძნებულს (TabBarScrollContext) — ეს
// უფრო უსაფრთხოა, ვიდრე მთელი ტაბ-ბარის თავიდან აწერა.
export function FloatingTabBar(props: BottomTabBarProps) {
  const { barScale } = useTabBarScroll();
  return (
    <Animated.View style={{ transform: [{ scale: barScale }] }}>
      <BottomTabBar {...props} />
    </Animated.View>
  );
}
