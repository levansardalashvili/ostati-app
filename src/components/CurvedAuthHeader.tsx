import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { BrandGlyph } from './BrandGlyph';
import { Reveal } from './Reveal';
import { colors, radius, spacing, typography } from '../theme';
import { motion } from '../utils/motion';
import { useKeyboardVisible } from '../utils/useKeyboardVisible';

// Curved auth header. Height follows the content; the SVG stretches to fit.
const BLOB_PATH = 'M0,0 L100,0 L100,58 C78,58 70,92 45,88 C25,85 15,65 0,68 Z';
// Room under the text so the curve doesn't cut it.
const CURVE_BOTTOM_PADDING = spacing.xxl * 3;

type Props = {
  subtitle?: string;
  // no back arrow when omitted
  onBack?: () => void;
  // brand, or the role label on Register
  brand?: string;
  // role emoji instead of the brand mark
  emoji?: string;
};

export function CurvedAuthHeader({ subtitle, onBack, brand = 'ოსტატო', emoji }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  // While typing the big header would eat a third of the screen — collapse it
  // to a thin bar (back button only) so the field being filled stays visible.
  if (keyboardVisible) {
    return (
      <View style={[styles.compactBar, { paddingTop: insets.top, height: insets.top + COMPACT_HEIGHT }]}>
        {onBack ? (
          <Pressable style={[styles.backButton, { top: insets.top + (COMPACT_HEIGHT - 36) / 2 }]} onPress={onBack}>
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <Text style={styles.compactBrand}>{brand}</Text>
      </View>
    );
  }

  return (
    <View style={styles.headerWrap}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="authHeader" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#1D4ED8" />
          </LinearGradient>
        </Defs>
        <Path d={BLOB_PATH} fill="url(#authHeader)" />
      </Svg>
      {onBack ? (
        <Pressable style={[styles.backButton, { top: insets.top + spacing.sm }]} onPress={onBack}>
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <View
        style={[
          styles.headerContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: CURVE_BOTTOM_PADDING },
        ]}
      >
        <Reveal from="none" scaleFrom={0.7} duration={motion.duration.slow}>
          <View style={styles.logoCircle}>
            {emoji ? <Text style={styles.logoEmoji}>{emoji}</Text> : <BrandGlyph size={34} color="#FFFFFF" />}
          </View>
        </Reveal>
        <Reveal delay={140}>
          <Text style={styles.brand}>{brand}</Text>
        </Reveal>
        {subtitle ? (
          <Reveal delay={220}>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </Reveal>
        ) : null}
      </View>
    </View>
  );
}

const COMPACT_HEIGHT = 52;

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
  },
  compactBar: {
    width: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBrand: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoEmoji: {
    fontSize: 28,
  },
  brand: {
    ...typography.h1,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
});
