import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  message: string | null;
  bottom?: number;
};

// მსუბუქი, თვითგამქრალი დადასტურების შეტყობინება (მაგ. "დაემატა
// რჩეულებში") — InlineBanner-ისგან/Alert.alert-ისგან განსხვავებით,
// მომხმარებლის დაჭერას არ საჭიროებს დასახურად, თავისით ქრება.
export function Toast({ message, bottom = spacing.xl }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity, bottom }]} pointerEvents="none">
      <CheckCircle2 size={16} color={colors.primaryForeground} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.foreground,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  text: {
    ...typography.captionMedium,
    color: colors.primaryForeground,
    flex: 1,
  },
});
