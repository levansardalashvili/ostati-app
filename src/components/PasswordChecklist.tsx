import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  password: string;
  confirmPassword: string;
};

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, ok && styles.dotOk]}>{ok && <Check size={10} color="#FFFFFF" strokeWidth={3} />}</View>
      <Text style={[styles.label, ok && styles.labelOk]}>{label}</Text>
    </View>
  );
}

// Password rules checklist (ResetPasswordScreen).
export function PasswordChecklist({ password, confirmPassword }: Props) {
  const lengthOk = password.length >= 8;
  const matchOk = !!confirmPassword && password === confirmPassword;
  return (
    <View style={styles.list}>
      <Row ok={lengthOk} label="მინიმუმ 8 სიმბოლო" />
      <Row ok={matchOk} label="პაროლები ემთხვევა" />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOk: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  label: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  labelOk: {
    color: colors.success,
  },
});
