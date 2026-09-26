import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from './motion';

// usePop — ღილაკის „აფეთქება“ მდგომარეობის ცვლილებაზე (მაგ. გულის მონიშვნა): მცირე გადიდება და springით დაბრუნება.
// პირველ რენდერზე არ მუშაობს (მხოლოდ რეალურ ცვლილებაზე). გამოყენება: <Animated.View style={{transform:[{scale}]}}>.
export function usePop(active: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    scale.setValue(active ? 0.7 : 0.9);
    Animated.spring(scale, { toValue: 1, friction: 3.2, tension: 220, useNativeDriver: true }).start();
  }, [active, reduceMotion, scale]);

  return scale;
}
