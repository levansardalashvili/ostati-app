import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Phone } from 'lucide-react-native';
import { GoogleButton } from './GoogleButton';
import { colors, radius, spacing, typography } from '../theme';
import { PHONE_AUTH_ENABLED } from '../config/features';

type Props = {
  onGoogle: () => void;
  gLoading: boolean;
  onApple: () => void;
  aLoading: boolean;
  appleAvailable: boolean;
  appleButtonType: AppleAuthentication.AppleAuthenticationButtonType;
  appleLoadingLabel: string;
  onPhone: () => void;
};

// Phone / Google / Apple round buttons (Login and Register).
export function SocialAuthRow({
  onGoogle,
  gLoading,
  onApple,
  aLoading,
  appleAvailable,
  appleButtonType,
  appleLoadingLabel,
  onPhone,
}: Props) {
  return (
    <View>
      <View style={styles.row}>
        {PHONE_AUTH_ENABLED && (
          <Pressable
            onPress={onPhone}
            accessibilityLabel="ტელეფონით გაგრძელება"
            style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
          >
            <Phone size={22} color={colors.foreground} />
          </Pressable>
        )}

        <GoogleButton variant="circle" loading={gLoading} onPress={onGoogle} />

        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={appleButtonType}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={28}
            style={styles.appleCircle}
            onPress={onApple}
          />
        )}
      </View>
      {aLoading && <Text style={styles.appleLoadingText}>{appleLoadingLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  appleCircle: {
    width: 56,
    height: 56,
  },
  appleLoadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
