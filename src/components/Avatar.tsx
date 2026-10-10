import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { VerifiedBadge } from './VerifiedBadge';

type Props = {
  initials: string;
  color?: string;
  size?: number;
  online?: boolean;
  // photo URL; initials when missing
  uri?: string;
  // verified badge, top-right (the online dot is bottom-right — both can show)
  verified?: boolean;
};

// Round avatar with initials or a photo.
export function Avatar({ initials, color = colors.primary, size = 44, online = false, uri, verified = false }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: radius.full, backgroundColor: color, overflow: 'hidden' },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
        )}
      </View>
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.27,
              height: size * 0.27,
              borderRadius: radius.full,
            },
          ]}
        />
      )}
      {verified && (
        <View style={styles.verifiedBadge}>
          <VerifiedBadge size={size * 0.38} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.card,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.card,
  },
});
