import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../theme';
import { motion, useReduceMotion } from '../utils/motion';

type Props = {
  size?: number;
  color?: string;
  tint?: string; // ფონის ფერი (ღია)
};

// SuccessCheck — „წარმატების“ მომენტი: წრე springით ამოდის, ჩეკი მის შემდეგ „ხტება“, გარშემო ტალღა ერთხელ იშლება.
// გამოიყენება გამოქვეყნების/შეფასების დასრულების ეკრანებზე. Reduce motion-ზე სტატიკურად ჩანს.
export function SuccessCheck({ size = 88, color = colors.success, tint }: Props) {
  const reduceMotion = useReduceMotion();
  const circle = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const check = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.spring(circle, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(check, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 700, easing: motion.easeOut, useNativeDriver: true }),
      ]),
    ]).start();
  }, [circle, check, ring, reduceMotion]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
      />
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint ?? color + '22',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: circle }],
        }}
      >
        <Animated.View style={{ transform: [{ scale: check }] }}>
          <Check size={size * 0.5} color={color} strokeWidth={3} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
