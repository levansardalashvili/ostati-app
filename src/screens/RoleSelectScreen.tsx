import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CurvedAuthHeader } from '../components/CurvedAuthHeader';
import { Reveal } from '../components/Reveal';
import { colors, radius, spacing, typography } from '../theme';
import { staggerDelay } from '../utils/motion';
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
    description: 'ვეძებ ოსტატს სამუშაოსთვის',
  },
  {
    role: 'provider',
    emoji: '🔧',
    title: 'ოსტატი',
    description: 'ვასრულებ სამუშაოს',
  },
];

// A2 — როლის არჩევის ეკრანი (product-spec.md; ტაპზე მაშინვე გრძელდება,
// დიზაინის რეფერენსის RoleSelectScreen-ის მიხედვით). Login/Register-ის
// იგივე curved-header (#167/#168) — brand default-ზეა ("ოსტატო"), რადგან
// როლი ჯერ არჩეული არაა.
export function RoleSelectScreen({ navigation }: Props) {
  const handleSelect = (role: Role) => {
    navigation.navigate('Register', { role });
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <CurvedAuthHeader subtitle="კეთილი იყოს თქვენი მობრძანება" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Reveal delay={260}>
          <Text style={styles.title}>აირჩიეთ თქვენი სტატუსი</Text>
        </Reveal>

        <View style={styles.cards}>
          {ROLES.map(({ role, emoji, title, description }, index) => (
            <Reveal key={role} delay={staggerDelay(index, 340)}>
              <Pressable
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
              </Pressable>
            </Reveal>
          ))}
        </View>

        <Reveal delay={480} style={styles.loginRow}>
          <Text style={styles.loginText}>უკვე გაქვს ანგარიში? </Text>
          <Pressable onPress={handleLogin}>
            <Text style={styles.loginLink}>შესვლა</Text>
          </Pressable>
        </Reveal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm + 2,
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
    alignItems: 'center',
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginBottom: spacing.xs / 2,
    textAlign: 'center',
  },
  cardDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
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
