import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  password: string;
};

const LEVELS = [
  { label: 'სუსტი', color: colors.destructive },
  { label: 'საშუალო', color: colors.warning },
  { label: 'კარგი', color: colors.primary },
  { label: 'ძლიერი', color: colors.success },
];

function scorePassword(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, LEVELS.length);
}

// პაროლის სიძლიერის ინდიკატორი — რეგისტრაციის დროს, პაროლის ველის ქვემოთ.
// segmented ზოლი + ტექსტური ლეიბლი, ფერადი 4 დონით (სუსტი→ძლიერი).
export function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[Math.max(score - 1, 0)];

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {LEVELS.map((_, i) => (
          <View
            key={i}
            style={[styles.bar, i < score && { backgroundColor: level.color }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: level.color }]}>{level.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  bars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  label: {
    ...typography.small,
  },
});
