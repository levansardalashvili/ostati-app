import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BrandMark } from '../components/BrandMark';
import { Reveal } from '../components/Reveal';
import { colors, spacing, typography } from '../theme';
import { useReduceMotion } from '../utils/motion';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

// A1 — Splash ეკრანი. აღარ არის ინტერაქციული (ძველი "დაწყება"/"შესვლა"
// ღილაკები მოცილებულია მომხმარებლის მოთხოვნით) — ლოგო/ბრენდი/ტექსტის
// ანიმაციის დასრულების შემდეგ ავტომატურად გადადის Login-ზე (`replace`, არა
// `navigate` — უკან დაბრუნება ამ ეკრანზე აზრს მოკლებულია).
export function WelcomeScreen({ navigation }: Props) {
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), reduceMotion ? 500 : 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <BrandMark />
        </View>
        <Reveal delay={180}>
          <Text style={styles.appName}>ოსტატო</Text>
        </Reveal>
        <Reveal delay={300}>
          <Text style={styles.tagline}>იპოვე სანდო ოსტატი შენთან ახლოს</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
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
});
