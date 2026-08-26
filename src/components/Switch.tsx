import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  activeColor?: string;
};

const WIDTH = 48;
const HEIGHT = 26;
const THUMB = 18;

// მორგებული toggle switch (დიზაინის რეფერენსის availability toggle-ის
// მიხედვით) — გამოიყენება Provider Home-ის ხელმისაწვდომობის toggle-სა და
// Notification Settings-ის toggle-ებში.
export function Switch({ value, onValueChange, activeColor = colors.success }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [4, WIDTH - THUMB - 4] });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? activeColor : colors.mutedForeground },
      ]}
    >
      <Animated.View style={[styles.thumb, { left }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
});
