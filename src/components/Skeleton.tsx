import React, { useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, LayoutChangeEvent, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
};

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);
const SWEEP_WIDTH = 90;

// ჩატვირთვის skeleton ბლოკი (app-states.md: "skeleton placeholders that
// match the final card/component shapes") — მოძრავი shimmer-ზოლით, ფლეთ
// ნაცრისფერი ბლოკის ნაცვლად. `expo-linear-gradient` უკვე bundled
// დამოკიდებულებაა (გრადიენტული CTA ბარათებისთვის) — ახალი dep არ
// დამატებულა. Container-ის სიგანე `onLayout`-ით იზომება (`width` prop
// ხშირად პროცენტულია, პიქსელებში წინასწარ უცნობი) — sweep მხოლოდ ამის
// შემდეგ ჩნდება.
export function Skeleton({ width = '100%', height = 16, borderRadius: r = radius.sm, style }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SWEEP_WIDTH, containerWidth + SWEEP_WIDTH],
  });

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.muted, overflow: 'hidden' },
        style,
      ]}
    >
      {containerWidth > 0 && (
        <AnimatedGradient
          colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: SWEEP_WIDTH,
            transform: [{ translateX }],
          }}
        />
      )}
    </View>
  );
}
