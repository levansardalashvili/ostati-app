import { Animated } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTabBarScroll } from '../state/TabBarScrollContext';

// The stock BottomTabBar, only scaled by barScale (TabBarScrollContext).
export function FloatingTabBar(props: BottomTabBarProps) {
  const { barScale } = useTabBarScroll();
  return (
    <Animated.View style={{ transform: [{ scale: barScale }] }}>
      <BottomTabBar {...props} />
    </Animated.View>
  );
}
