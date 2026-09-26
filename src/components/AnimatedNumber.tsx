import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, Text, TextStyle } from 'react-native';
import { motion, useReduceMotion } from '../utils/motion';

type Props = {
  value: number;
  // ჩვენებისთვის: მაგ. (n) => `${Math.round(n).toLocaleString('ka')} ₾` ან ერთი ათწილადი რეიტინგისთვის
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
};

// AnimatedNumber — რიცხვი 0-დან (ან წინა მნიშვნელობიდან) ახალამდე „ითვლის“ (სტატისტიკა, ფასი, რეიტინგი). ტექსტს
// ვცვლით listener-ით (native driver-ით ტექსტის ცვლილება შეუძლებელია), მაგრამ ხანგრძლივობა ~700ms-ია და მხოლოდ
// რიცხვის ცვლილებისას მუშაობს — ეკრანს არ ამძიმებს.
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 700, style }: Props) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(reduceMotion ? value : 0)).current;
  const [shown, setShown] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(value);
      setShown(value);
      return;
    }
    const t = Animated.timing(anim, { toValue: value, duration, easing: motion.easeOut, useNativeDriver: false });
    t.start();
    return () => t.stop();
  }, [value, reduceMotion, duration, anim]);

  return <Text style={style}>{format(shown)}</Text>;
}
