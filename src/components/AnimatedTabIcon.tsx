import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from '../utils/motion';

type Props = { focused: boolean; children: React.ReactNode };

// AnimatedTabIcon — ტაბის აიქონი არჩევისას მცირედ „ხტება“ (spring) და 1px-ით მაღლდება; აქტიური ტაბი „ცოცხალი“ ჩანს.
export function AnimatedTabIcon({ focused, children }: Props) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(focused ? 1 : 0.94)).current;
  const lift = useRef(new Animated.Value(focused ? -1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      lift.setValue(0);
      return;
    }
    if (focused) {
      scale.setValue(0.82);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.06, friction: 4, tension: 200, useNativeDriver: true }),
        Animated.spring(lift, { toValue: -1, friction: 6, tension: 160, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.94, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(lift, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [focused, reduceMotion, scale, lift]);

  return <Animated.View style={{ transform: [{ scale }, { translateY: lift }] }}>{children}</Animated.View>;
}
