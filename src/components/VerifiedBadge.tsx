import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radius } from '../theme';

// Verified provider badge.
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Check size={size * 0.62} color={colors.primaryForeground} strokeWidth={3} />
    </View>
  );
}
