import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Wrench } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Reveal } from './Reveal';
import { colors, radius, spacing, typography } from '../theme';
import { motion } from '../utils/motion';

// ბორბლისებრი curved-header (ვიდეო-რეფერენსის ფორმა), აპის ერთი ლურჯი
// აქცენტით (#2563EB→#1D4ED8, decision #5) — გაზიარებული Login/Register-ს შორის.
// სიმაღლე *არ* არის ფიქსირებული რიცხვი — headerWrap თავად შეიცვლის ზომას
// შიგთავსის მიხედვით (subtitle-იან Login-ზე გრძელი, subtitle-ის გარეშე
// Register-ზე მოკლე) — Svg (absoluteFill) ავტომატურად „იჭიმება“ რაც არ
// უნდა სიმაღლე გამოვიდეს, JS-გაზომვის გარეშე.
const BLOB_PATH = 'M0,0 L100,0 L100,58 C78,58 70,92 45,88 C25,85 15,65 0,68 Z';
// ტალღას სჭირდება ცარიელი სივრცე ტექსტის ქვემოთ — თორემ curve ტექსტს „მოსჭრის“
const CURVE_BOTTOM_PADDING = spacing.xxl * 3;

type Props = {
  // Login-ის "კეთილი იყოს..." ტიპის ტექსტი brand-ის ქვემოთ — არასავალდებულო
  // (Register-ს აღარ სჭირდება, #167-ის მოთხოვნით)
  subtitle?: string;
  // არასავალდებულო — თუ არ არის მოცემული, უკან-ისარი საერთოდ არ ჩანს
  // (Login-ს აღარ სჭირდება, #170: Welcome ახლა `replace`-ავს Login-ზე,
  // stack-ში წინა ეკრანი აღარ რჩება)
  onBack?: () => void;
  // default "ოსტატო" (აპის ბრენდი, Login-ზე); Register-ს შეუძლია აქ
  // არჩეული როლის ლეიბლი გადასცეს ("მომხმარებელი"/"ოსტატი") — ეს როლის
  // სახელია, არა ბრენდი, ამიტომ "ოსტატი" ფორმით რჩება უცვლელი.
  brand?: string;
  // მოცემულია, თუ Register-ს RoleSelectScreen-ის იგივე emoji-ს (🏠/🔧) სჭირდება
  // Wrench-ლოგოს ნაცვლად — default undefined ინარჩუნებს Login-ის Wrench-ს
  emoji?: string;
};

export function CurvedAuthHeader({ subtitle, onBack, brand = 'ოსტატო', emoji }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.headerWrap}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="authHeader" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#1D4ED8" />
          </LinearGradient>
        </Defs>
        <Path d={BLOB_PATH} fill="url(#authHeader)" />
      </Svg>
      {onBack ? (
        <Pressable style={[styles.backButton, { top: insets.top + spacing.sm }]} onPress={onBack}>
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <View
        style={[
          styles.headerContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: CURVE_BOTTOM_PADDING },
        ]}
      >
        <Reveal from="none" scaleFrom={0.7} duration={motion.duration.slow}>
          <View style={styles.logoCircle}>
            {emoji ? <Text style={styles.logoEmoji}>{emoji}</Text> : <Wrench size={26} color="#FFFFFF" strokeWidth={1.8} />}
          </View>
        </Reveal>
        <Reveal delay={140}>
          <Text style={styles.brand}>{brand}</Text>
        </Reveal>
        {subtitle ? (
          <Reveal delay={220}>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </Reveal>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoEmoji: {
    fontSize: 28,
  },
  brand: {
    ...typography.h1,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
});
