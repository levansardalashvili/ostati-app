import { Dimensions } from 'react-native';

export { colors } from './colors';

export const radius = {
  sm: 10,
  md: 12,
  lg: 16, // ძირითადი card radius (დიზაინის რეფერენსი: 12-16px)
  xl: 20,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Font sizes scale moderately with screen width (base 375dp, factor 0.35,
// clamped to 0.85–1.15). Portrait only, so read the width once.
// OS accessibility font scaling still applies on top.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASELINE_WIDTH = 375;
const MODERATE_FACTOR = 0.35;
const rawScale = SCREEN_WIDTH / BASELINE_WIDTH;
const clampedScale = Math.min(Math.max(rawScale, 0.85), 1.15);

function scaleFont(size: number): number {
  return Math.round(size + (size * clampedScale - size) * MODERATE_FACTOR);
}

export const typography = {
  h1: { fontSize: scaleFont(24), fontWeight: '600' as const, lineHeight: scaleFont(32) },
  h2: { fontSize: scaleFont(20), fontWeight: '600' as const, lineHeight: scaleFont(28) },
  h3: { fontSize: scaleFont(18), fontWeight: '600' as const, lineHeight: scaleFont(26) },
  body: { fontSize: scaleFont(16), fontWeight: '400' as const, lineHeight: scaleFont(24) },
  bodyMedium: { fontSize: scaleFont(16), fontWeight: '500' as const, lineHeight: scaleFont(24) },
  caption: { fontSize: scaleFont(14), fontWeight: '400' as const, lineHeight: scaleFont(20) },
  captionMedium: { fontSize: scaleFont(14), fontWeight: '500' as const, lineHeight: scaleFont(20) },
  small: { fontSize: scaleFont(12), fontWeight: '400' as const, lineHeight: scaleFont(16) },
};
