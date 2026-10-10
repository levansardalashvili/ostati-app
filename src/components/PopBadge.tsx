import { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

// Unread dot that pops in on mount (it is mounted only while there is something unread).
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
