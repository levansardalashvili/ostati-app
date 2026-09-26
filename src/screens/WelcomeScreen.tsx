import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wrench } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Reveal } from '../components/Reveal';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

// A1 — Splash / Welcome ეკრანი (product-spec.md)
export function WelcomeScreen({ navigation }: Props) {
  const handleStart = () => {
    navigation.navigate('RoleSelect');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Reveal from="none" scaleFrom={0.6} duration={560}>
          <View style={styles.logoCircle}>
            <Wrench size={40} color={colors.primary} strokeWidth={1.8} />
          </View>
        </Reveal>
        <Reveal delay={180}>
          <Text style={styles.appName}>ოსტატი</Text>
        </Reveal>
        <Reveal delay={300}>
          <Text style={styles.tagline}>იპოვე სანდო ოსტატი შენთან ახლოს</Text>
        </Reveal>
      </View>

      <Reveal delay={480} style={styles.actions}>
        <Button label="დაწყება" variant="primary" onPress={handleStart} />
        <Button label="შესვლა" variant="text" onPress={handleLogin} />
      </Reveal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
