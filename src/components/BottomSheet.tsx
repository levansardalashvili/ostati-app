import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ქვევიდან ამომხტარი ფურცელი (დიზაინის რეფერენსში გამოყენებული "sheet"
// pattern-ის მიხედვით — ოსტატის არჩევის დადასტურება, სამუშაოს გაუქმება და
// ა.შ.). Web-ის absolute-positioned overlay-ს ნაცვლად native Modal-ს
// ვიყენებთ, რაც მობილურზე უფრო იდიომურია.
//
// KeyboardAvoidingView აქ ცენტრალურადაა — ყველა sheet, რომელსაც
// TextInput აქვს (OfferPriceSheet, ReportJobSheet, პაროლის შეცვლის sheet
// და ა.შ.), ერთდროულად სარგებლობს ამით, ცალ-ცალკე ცვლილების გარეშე.
// Android-ზე `behavior: undefined`-ის ნაცვლად `'height'` — native
// window-resize (`android.softwareKeyboardLayoutMode: "resize"`) ჩუმად
// არ მუშაობს edge-to-edge Android-ზე (Expo SDK 52+ default), ისე რომ
// sheet-ის შიგნით TextInput-ს კლავიატურა მთლიანად ფარავდა.
//
// Modal-ის ჩაშენებული `animationType="slide"` ჩანაცვლებულია საკუთარი
// spring-ანიმაციით (backdrop fade + sheet-ის slide-up) — `visible=false`-ზე
// Modal ავტომატურად მყისიერად unmount-დებოდა, closing-ანიმაციის გარეშე;
// `mounted` local state Modal-ს ცოცხლად ინახავს გასვლის ანიმაციის
// დასრულებამდე.
export function BottomSheet({ visible, onClose, children }: Props) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, backdropOpacity, translateY]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
});
