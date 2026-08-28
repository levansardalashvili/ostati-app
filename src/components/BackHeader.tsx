import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
};

// უკან ისარი + სათაური + არასავალდებულო მარჯვენა ელემენტი (დიზაინის
// რეფერენსის BackHeader-ის მიხედვით) — გამოიყენება Job Detail-ის მსგავს
// ქვედონეების ეკრანებზე. showBack={false} — მაგ. სავალდებულო ეკრანებზე
// (RatingScreen), სადაც უკან დაბრუნება დაბლოკილია.
export function BackHeader({ title, onBack, right, showBack = true }: Props) {
  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable style={styles.iconButton} onPress={onBack}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
      <Text style={styles.title}>{title}</Text>
      {right ?? <View style={styles.iconButton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
});
