import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../theme';
import type { Role, RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelect'>;

const ROLES: {
  role: Role;
  emoji: string;
  title: string;
  description: string;
}[] = [
  {
    role: 'customer',
    emoji: '🏠',
    title: 'მომხმარებელი',
    description:
      'ვეძებ ოსტატს სახლის სამუშაოებისთვის. ვაქვეყნებ განცხადებებს და ვირჩევ საუკეთესოს.',
  },
  {
    role: 'provider',
    emoji: '🔧',
    title: 'ოსტატი',
    description:
      'ვარ პროფესიონალი. ვქმნი პროფილს, ვათვალიერებ განცხადებებს და ვასრულებ სამუშაოებს.',
  },
];

// A2 — როლის არჩევის ეკრანი (product-spec.md; ტაპზე მაშინვე გრძელდება,
// დიზაინის რეფერენსის RoleSelectScreen-ის მიხედვით)
export function RoleSelectScreen({ navigation }: Props) {
  const handleSelect = (role: Role) => {
    navigation.navigate('Register', { role });
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Nav-fix pass, task 7 — this screen previously had no Back
          navigation at all (Welcome → RoleSelect was a normal stack push,
          so goBack() already correctly returns to Welcome; it just had no
          on-screen affordance to trigger it). A plain top-left button, not
          a full header (no title needed alongside the existing eyebrow/
          title text below) — kept outside the centered `content` block so
          the role cards' vertical centering is unaffected. */}
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>კეთილი იყოს თქვენი მობრძანება</Text>
        <Text style={styles.title}>აირჩიეთ თქვენი სტატუსი</Text>

        <View style={styles.cards}>
          {ROLES.map(({ role, emoji, title, description }) => (
            <Pressable
              key={role}
              onPress={() => handleSelect(role)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.emojiBadge}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDescription}>{description}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>უკვე გაქვს ანგარიში? </Text>
          <Pressable onPress={handleLogin}>
            <Text style={styles.loginLink}>შესვლა</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xl,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.85,
  },
  emojiBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  emoji: {
    fontSize: 24,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginBottom: spacing.xs / 2,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  loginText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  loginLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
});
