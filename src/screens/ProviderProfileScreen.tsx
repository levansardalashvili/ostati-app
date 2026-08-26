import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Briefcase,
  Camera,
  ChevronRight,
  Eye,
  HelpCircle,
  LogOut,
  MapPin,
  Pencil,
  Settings,
  Star,
} from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ProfileMenuRow } from '../components/ProfileMenuRow';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MENU = [
  { icon: Pencil, label: 'პროფილის რედაქტირება', bg: '#EFF6FF', color: '#2563EB', badge: 0 },
  { icon: MapPin, label: 'დაფარვის რაიონები', bg: '#ECFDF5', color: '#059669', badge: 0 },
  { icon: Briefcase, label: 'შესრულებული სამუშაოები', bg: '#F5F3FF', color: '#7C3AED', badge: 312 },
  { icon: Star, label: 'შეფასებები', bg: '#FFFBEB', color: '#D97706', badge: 127 },
  { icon: Bell, label: 'შეტყობინებები', bg: colors.muted, color: colors.mutedForeground, badge: 3 },
  { icon: HelpCircle, label: 'დახმარება', bg: '#ECFEFF', color: '#0891B2', badge: 0 },
  { icon: Settings, label: 'ანგარიშის პარამეტრები', bg: colors.muted, color: colors.mutedForeground, badge: 0 },
];

const STATS = [
  { value: '4.9★', label: '127 შეფ.' },
  { value: '312', label: 'შესრულ. სამ.' },
  { value: '15 წ.', label: 'გამოცდ.' },
];

// E1 — Provider-ის პროფილის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// ProviderProfile-ის მიხედვით)
export function ProviderProfileScreen({ navigation }: Props) {
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  const handleMenuPress = (_label: string) => {
    // TODO: ამ მენიუს პუნქტების ეკრანები ჯერ არ არსებობს
  };

  const confirmLogout = () => {
    setLogoutSheetOpen(false);
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>პროფილი</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            <Avatar initials="გბ" color={colors.primary} size={72} online />
            <Pressable style={styles.cameraBadge} onPress={() => handleMenuPress('photo')}>
              <Camera size={10} color={colors.primaryForeground} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>გიორგი ბერიძე</Text>
              <VerifiedBadge size={15} />
            </View>
            <Text style={styles.specialty}>სანტექნიკოსი</Text>
            <Text style={styles.experience}>15 წელი გამოცდილება</Text>
            <View style={styles.ratingRow}>
              <Star size={12} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.ratingValue}>4.9</Text>
              <Text style={styles.ratingMeta}>· 127 შეფ. · 312 სამ.</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.availabilityRow}>
          <View style={styles.availabilityDot} />
          <Text style={styles.availabilityText}>ხელმისაწვდომი</Text>
          <Text style={styles.availabilityNote}>· მთ. კონტ. Provider Home-ზე</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Pressable style={styles.previewButton} onPress={() => handleMenuPress('preview')}>
          <View style={styles.previewLeft}>
            <View style={styles.previewIcon}>
              <Eye size={17} color="#FFFFFF" />
            </View>
            <Text style={styles.previewText}>ნახე ჩემი პროფილი მომხმ. თვალით</Text>
          </View>
          <ChevronRight size={15} color="#BFDBFE" />
        </Pressable>

        {MENU.map((item) => (
          <ProfileMenuRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            iconBg={item.bg}
            iconColor={item.color}
            badge={item.badge}
            badgeVariant="tint"
            onPress={() => handleMenuPress(item.label)}
          />
        ))}

        <Pressable style={styles.logoutRow} onPress={() => setLogoutSheetOpen(true)}>
          <View style={styles.logoutIcon}>
            <LogOut size={17} color={colors.destructive} />
          </View>
          <Text style={styles.logoutText}>გასვლა</Text>
        </Pressable>
      </ScrollView>

      <BottomSheet visible={logoutSheetOpen} onClose={() => setLogoutSheetOpen(false)}>
        <View style={styles.logoutSheetIcon}>
          <LogOut size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>გასვლა</Text>
        <Text style={styles.sheetSubtitle}>ნამდვილად გსურს ანგარიშიდან გასვლა?</Text>
        <Button label="გასვლა" variant="destructive" onPress={confirmLogout} />
        <Pressable style={styles.sheetCancelLink} onPress={() => setLogoutSheetOpen(false)}>
          <Text style={styles.sheetCancelLinkText}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.h3,
    color: colors.foreground,
  },
  specialty: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  experience: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs + 2,
  },
  ratingValue: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  ratingMeta: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  statValue: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  availabilityText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
  },
  availabilityNote: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    ...typography.captionMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    ...typography.captionMedium,
    color: colors.destructive,
    fontWeight: '600',
  },
  logoutSheetIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm + 2,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sheetCancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sheetCancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
});
