import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Wrench } from 'lucide-react-native';
import { Circle, Svg } from 'react-native-svg';
import { colors } from '../theme';
import { motion, useReduceMotion } from '../utils/motion';
import { Reveal } from './Reveal';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STROKE = 4;

type Props = {
  size?: number;
  delay?: number;
};

// აპის ლოგო — ლურჯი „დახატვადი“ რგოლი + wrench, გატანილია WelcomeScreen-იდან
// (#170), რომ სხვა ეკრანებმაც (RegistrationSuccessScreen) იგივე ბრენდის
// ვიზუალი გაიზიარონ დუბლირების გარეშე.
export function BrandMark({ size = 116, delay = 300 }: Props) {
  const reduceMotion = useReduceMotion();
  const ringProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const logoSize = size * 0.76;

  useEffect(() => {
    if (!reduceMotion) {
      Animated.timing(ringProgress, {
        toValue: 1,
        duration: 900,
        delay,
        easing: motion.easeInOut,
        useNativeDriver: false,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const strokeDashoffset = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Reveal from="none" scaleFrom={0.6} duration={560}>
        <View
          style={[
            styles.logoCircle,
            { width: logoSize, height: logoSize, borderRadius: logoSize / 2 },
          ]}
        >
          <Wrench size={size * 0.34} color={colors.primary} strokeWidth={1.8} />
        </View>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  logoCircle: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
