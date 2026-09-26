import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../theme';

type Item = { value: string; label: string };

type Props = {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  itemHeight?: number;
  visibleCount?: number; // კენტი რიცხვი — შუა რიგი არჩეულია
  testID?: string;
};

// WheelPicker — ვერტიკალური „ბორბალი“ (iOS-ის დროის არჩევანის მსგავსი): შუა რიგი არჩეულია, დანარჩენი გადახვევით/დაჭერით
// მოდის. სუფთა React Native (ScrollView + snapToInterval), native module არ სჭირდება. ეკრანს არ აგრძელებს — ყოველთვის
// visibleCount რიგის სიმაღლისაა, რამდენი პუნქტიც არ უნდა იყოს.
export function WheelPicker({ items, value, onChange, itemHeight = 48, visibleCount = 5, testID }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(0, items.findIndex((i) => i.value === value));
  const [active, setActive] = useState(index);
  const pad = itemHeight * Math.floor(visibleCount / 2);

  // საწყისი პოზიცია (Android-ზე contentOffset ყოველთვის არ მუშაობს — scrollTo layout-ის შემდეგ)
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: index * itemHeight, animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indexAt = (y: number) => Math.min(items.length - 1, Math.max(0, Math.round(y / itemHeight)));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e.nativeEvent.contentOffset.y);
    if (i !== active) setActive(i);
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e.nativeEvent.contentOffset.y);
    setActive(i);
    if (items[i].value !== value) onChange(items[i].value);
  };
  const pick = (i: number) => {
    scrollRef.current?.scrollTo({ y: i * itemHeight, animated: true });
    setActive(i);
    onChange(items[i].value);
  };

  return (
    <View style={{ height: itemHeight * visibleCount }} testID={testID}>
      <View pointerEvents="none" style={[styles.band, { top: pad, height: itemHeight }]} />
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {items.map((it, i) => {
          const dist = Math.abs(i - active);
          return (
            <Pressable key={it.value} onPress={() => pick(i)} style={[styles.row, { height: itemHeight }]}>
              <Text style={[styles.label, dist === 0 ? styles.labelActive : dist === 1 ? styles.labelNear : styles.labelFar]}>{it.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.primary + '14',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  row: { alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.h3, color: colors.foreground },
  labelActive: { color: colors.primary, fontWeight: '700' },
  labelNear: { opacity: 0.6 },
  labelFar: { opacity: 0.3 },
});
