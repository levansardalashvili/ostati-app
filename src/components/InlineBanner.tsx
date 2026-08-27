import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

type BannerType = 'success' | 'error' | 'warning';

type Props = {
  type: BannerType;
  msg: string;
  action?: string;
  onAction?: () => void;
};

const CONFIG: Record<BannerType, { bg: string; border: string; text: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  success: { bg: colors.successBackground, border: '#A7F3D0', text: colors.success, icon: CheckCircle },
  error: { bg: colors.dangerBackground, border: '#FECACA', text: colors.destructive, icon: AlertCircle },
  warning: { bg: colors.warningBackground, border: '#FDE68A', text: colors.warning, icon: AlertCircle },
};

// InlineBanner — success/error/warning ხაზოვანი შეტყობინება (ზიპის
// App.tsx-ის InlineBanner-ის მიხედვით) — გამოიყენება ფორმის შენახვის
// შეცდომების ჩვენებისთვის (Edit Profile ეკრანები).
export function InlineBanner({ type, msg, action, onAction }: Props) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;
  return (
    <View style={[styles.row, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Icon size={15} color={cfg.text} />
      <Text style={[styles.msg, { color: cfg.text }]}>{msg}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: cfg.text }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.sm + 2,
  },
  msg: {
    ...typography.small,
    fontWeight: '600',
    flex: 1,
  },
  action: {
    ...typography.small,
    fontWeight: '700',
  },
});
