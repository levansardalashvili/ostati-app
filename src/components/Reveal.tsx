import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion, useReduceMotion } from '../utils/motion';

type Props = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  // საიდან „ამოდის“ ელემენტი
  from?: 'bottom' | 'top' | 'left' | 'right' | 'none';
  distance?: number;
  // დასაწყისი მასშტაბი (1 = მასშტაბის ცვლილების გარეშე), მაგ. 0.94 — „ჩაწევიდან“ ამოსვლა
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
};

// Reveal — შვილის ლამაზი გამოჩენა mount-ზე: გამჭვირვალობა + მცირე გადაადგილება (და სურვილისამებრ მასშტაბი).
// ჩამონათვალში `delay={staggerDelay(index)}` — ბარათები ერთმანეთის მიყოლებით, „ტალღით“ ჩნდება.
// Skeleton → კონტენტის გადასვლა: კონტენტი ახლადმონტირებულია, ამიტომ ავტომატურად „ჩამოდნება“.
// native driver — JS thread-ს არ ტვირთავს. Reduce motion-ზე: მყისიერად სრულად ჩანს.
export function Reveal({ children, delay = 0, duration = motion.duration.base, from = 'bottom', distance = 14, scaleFrom = 1, style }: Props) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, { toValue: 1, duration, delay, easing: motion.easeOut, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  type Interp = Animated.AnimatedInterpolation<number>;
  const transform: ({ translateY: Interp } | { translateX: Interp } | { scale: Interp })[] = [];
  if (from === 'bottom') transform.push({ translateY: offset });
  else if (from === 'top') transform.push({ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-distance, 0] }) });
  else if (from === 'left') transform.push({ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-distance, 0] }) });
  else if (from === 'right') transform.push({ translateX: offset });
  if (scaleFrom !== 1) transform.push({ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }) });

  return <Animated.View style={[{ opacity: progress, transform }, style]}>{children}</Animated.View>;
}
