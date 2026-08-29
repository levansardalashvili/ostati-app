import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Briefcase,
  Camera,
  ChevronRight,
  ClipboardList,
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
import { colors, radius, spacing, typography } from '../theme';
import { EXPERIENCE_OPTIONS } from '../data/experience';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { computeCompleteness, useProviderProfile } from '../state/ProviderProfileContext';
import { isNewProvider } from '../utils/providerRank';
import type { ProviderTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ProviderTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

// E1 — Provider-ის პროფილის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// ProviderProfile-ის მიხედვით)
export function ProviderProfileScreen({ navigation }: Props) {
  const { profile } = useProviderProfile();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
  const specialtyLabel = profile.specialty[0]?.label ?? '';
  const experienceLabel = EXPERIENCE_OPTIONS.find((e) => e.id === profile.experience)?.label ?? '';
  const completeness = computeCompleteness(profile);

  // რეალური rating/reviews/jobs (#71) — ადრე ჰარდქოდილი "4.9★/127 შეფ./312
  // სამ." იყო, ანგარიშის რეალურ მდგომარეობასთან დაუკავშირებელი.
  const uid = authService.getCurrentUser()?.uid ?? null;
  // `null` სანამ არ ჩაიტვირთება (არა `{rating:0,...}` საწყისიდანვე) — თუ
  // 0-ზე დაწყებულს გვექნებოდა, `isNewProvider`-ის ternary ქვემოთ ჯერ ერთ
  // ფრაგმენტს (⭐-ის გარეშე) დახატავდა, მერე fetch-ის დასრულებისთანავე
  // მთლიანად სხვა ფრაგმენტზე (⭐+რიცხვები) გადავიდოდა — ეს ტიპის ცვლილება
  // ერთსა და იმავე position-ზე Fabric-ის ცნობილი Android crash-ია
  // ("addViewAt... child already has a parent", #71-ის loading-guard-ების
  // იგივე ოჯახის ბაგი). `null`-ის დროს საერთოდ არაფერი არ ვრენდერავთ იმ
  // ადგილას — ცარიელიდან შევსებულზე გადასვლა კი უსაფრთხოა.
  const [stats, setStats] = useState<{ rating: number; reviews: number; jobs: number } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    userService
      .getRealProviderById(uid)
      .then((real) => {
        if (!cancelled) setStats({ rating: real?.rating ?? 0, reviews: real?.reviews ?? 0, jobs: real?.jobs ?? 0 });
      })
      .catch(() => {
        if (!cancelled) setStats({ rating: 0, reviews: 0, jobs: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  const displayStats = stats ?? { rating: 0, reviews: 0, jobs: 0 };

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  useEffect(() => {
    if (!uid) return;
    return notificationService.subscribeToUnreadCount(uid, setUnreadNotifCount);
  }, [uid]);

  const MENU = [
    { icon: Pencil, label: 'პროფილის რედაქტირება', bg: '#EFF6FF', color: '#2563EB', badge: 0 },
    { icon: MapPin, label: 'სამუშაო არეალი', bg: '#ECFDF5', color: '#059669', badge: 0 },
    { icon: ClipboardList, label: 'ჩემი სამუშაო', bg: '#FFF7ED', color: '#EA580C', badge: 0 },
    { icon: Briefcase, label: 'შესრულებული სამუშაოები', bg: '#F5F3FF', color: '#7C3AED', badge: displayStats.jobs },
    { icon: Star, label: 'შეფასებები', bg: '#FFFBEB', color: '#D97706', badge: displayStats.reviews },
    { icon: Bell, label: 'შეტყობინებები', bg: colors.muted, color: colors.mutedForeground, badge: unreadNotifCount },
    { icon: HelpCircle, label: 'დახმარება', bg: '#ECFEFF', color: '#0891B2', badge: 0 },
    { icon: Settings, label: 'ანგარიშის პარამეტრები', bg: colors.muted, color: colors.mutedForeground, badge: 0 },
  ];

  const handleMenuPress = (label: string) => {
    if (label === 'preview') {
      if (uid) navigation.navigate('ViewProviderProfile', { id: uid });
    } else if (label === 'პროფილის რედაქტირება' || label === 'photo') {
      navigation.navigate('ProviderEditProfile');
    } else if (label === 'სამუშაო არეალი') {
      navigation.navigate('ProviderServiceAreas');
    } else if (label === 'ჩემი სამუშაო') {
      navigation.navigate('MyJobsTab');
    } else if (label === 'შესრულებული სამუშაოები') {
      navigation.navigate('ProviderCompletedJobs');
    } else if (label === 'შეფასებები') {
      navigation.navigate('ProviderReviews');
    } else if (label === 'შეტყობინებები') {
      navigation.navigate('Notifications', { role: 'provider' });
    } else if (label === 'ანგარიშის პარამეტრები') {
      navigation.navigate('ProfileSettings');
    }
    // "დახმარება" — TODO: ეს ეკრანი ზიპშივე არ არსებობდა (screen: null)
  };

  const confirmLogout = () => {
    setLogoutSheetOpen(false);
    authService.signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>პროფილი</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            <Avatar initials={initials} color={colors.primary} size={72} online uri={profile.photoUrl} />
            <Pressable style={styles.cameraBadge} onPress={() => handleMenuPress('photo')}>
              <Camera size={10} color={colors.primaryForeground} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {profile.firstName} {profile.lastName}
              </Text>
            </View>
            {!!specialtyLabel && <Text style={styles.specialty}>{specialtyLabel}</Text>}
            {!!experienceLabel && <Text style={styles.experience}>{experienceLabel} გამოცდილება</Text>}
            <View style={styles.ratingRow}>
              {stats &&
                (isNewProvider({ reviews: stats.reviews }) ? (
                  <Text style={styles.ratingMeta}>ახალი ოსტატი</Text>
                ) : (
                  <>
                    <Star size={12} color="#FBBF24" fill="#FBBF24" />
                    <Text style={styles.ratingValue}>{stats.rating.toFixed(1)}</Text>
                    <Text style={styles.ratingMeta}>
                      · {stats.reviews} შეფ. · {stats.jobs} სამ.
                    </Text>
                  </>
                ))}
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{displayStats.reviews === 0 ? '—' : `${displayStats.rating.toFixed(1)}★`}</Text>
            <Text style={styles.statLabel}>{displayStats.reviews} შეფ.</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{displayStats.jobs}</Text>
            <Text style={styles.statLabel}>შესრულ. სამ.</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{experienceLabel || '—'}</Text>
            <Text style={styles.statLabel}>გამოცდ.</Text>
          </View>
        </View>

        <View style={styles.availabilityRow}>
          <View style={styles.availabilityDot} />
          <Text style={styles.availabilityText}>ხელმისაწვდომი</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {completeness.percent < 100 && (
          <Pressable style={styles.completenessCard} onPress={() => navigation.navigate('ProviderEditProfile')}>
            <View style={styles.completenessHeaderRow}>
              <Text style={styles.completenessTitle}>პროფილის სისრულე</Text>
              <Text style={styles.completenessPercent}>{completeness.percent}%</Text>
            </View>
            <View style={styles.completenessTrack}>
              <View style={[styles.completenessFill, { width: `${completeness.percent}%` }]} />
            </View>
            <View style={styles.completenessMissingRow}>
              {completeness.missing.map((item) => (
                <View key={item.key} style={[styles.completenessChip, item.optional && styles.completenessChipOptional]}>
                  <Text style={[styles.completenessChipText, item.optional && styles.completenessChipTextOptional]}>
                    {item.label}
                    {item.optional ? ' (სურვილისამებრ)' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}

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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
  completenessCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  completenessHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  completenessTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  completenessPercent: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  completenessTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    marginBottom: spacing.sm + 2,
  },
  completenessFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  completenessMissingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  completenessChip: {
    backgroundColor: colors.warningBackground,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  completenessChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  completenessChipOptional: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  completenessChipTextOptional: {
    color: colors.mutedForeground,
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
