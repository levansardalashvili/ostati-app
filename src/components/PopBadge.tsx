import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

// წვრილი წითელი წერტილი (tab-bar-ის წაუკითხავი ჩატის ინდიკატორი, #68) —
// mount-ზე pop-in scale ანიმაციით, ხმამაღალი "ჩაშენების" ნაცვლად. Component
// მთელი lifecycle-ის მანძილზე conditionally (un)mount-დება (`unreadChats >
// 0 && !focused && <PopBadge/>`) — ამიტომ mount თავად "გამოჩენის" მომენტია,
// ცალკე imperative trigger არ სჭირდება.
export function PopBadge({ style }: { style: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      useNativeDriver: true,
      duration: 90,
    }).start();
  }, [scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]} />;
}
