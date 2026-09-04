import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Briefcase, Camera, Heart, LogOut, MapPin, Pencil, Settings } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ProfileMenuRow } from '../components/ProfileMenuRow';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { notificationService } from '../services/notificationService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useFavoriteProviders } from '../state/FavoriteProvidersContext';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

// E2 — Customer-ის პროფილის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// CustomerProfile-ის მიხედვით)
export function CustomerProfileScreen({ navigation }: Props) {
  const { profile } = useCustomerProfile();
  const { favoriteIds } = useFavoriteProviders();
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  const uid = authService.getCurrentUser()?.uid ?? null;
  const [myJobsCount, setMyJobsCount] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    jobService
      .listMyJobPosts(uid)
      .then((jobs) => {
        if (!cancelled) setMyJobsCount(jobs.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  useEffect(() => {
    if (!uid) return;
    return notificationService.subscribeToUnreadCount(uid, setUnreadNotifCount);
  }, [uid]);

  const MENU = [
    { icon: Briefcase, label: 'ჩემი მოთხოვნები', bg: '#EFF6FF', color: '#2563EB', badge: myJobsCount },
    { icon: Heart, label: 'შენახული ოსტატები', bg: '#FEF2F2', color: '#DC2626', badge: favoriteIds.size },
    { icon: Pencil, label: 'პროფილის რედაქტირება', bg: '#F5F3FF', color: '#7C3AED', badge: 0 },
    { icon: Bell, label: 'შეტყობინებები', bg: '#FFFBEB', color: '#D97706', badge: unreadNotifCount },
    { icon: Settings, label: 'ანგარიშის პარამეტრები', bg: colors.muted, color: colors.mutedForeground, badge: 0 },
  ];

  const handleMenuPress = (label: string) => {
    if (label === 'ჩემი მოთხოვნები') {
      navigation.navigate('MyJobsTab');
    } else if (label === 'შენახული ოსტატები') {
      navigation.navigate('SavedProviders');
    } else if (label === 'პროფილის რედაქტირება') {
      navigation.navigate('CustomerEditProfile');
    } else if (label === 'შეტყობინებები') {
      navigation.navigate('Notifications', { role: 'customer' });
    } else if (label === 'ანგარიშის პარამეტრები') {
      navigation.navigate('ProfileSettings');
    }
  };

  const confirmLogout = () => {
    setLogoutSheetOpen(false);
    // navigation reset-ს ჯერ ვასრულებთ, სამუშაო UI-ს (fire-and-forget) —
    // signOut()-ის დასრულების დალოდება აქ საჭირო არაა, უკვე Welcome-ზეა.
    authService.signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Nav-fix pass, task 3 — restructured to visually/structurally match
          ProviderProfileScreen.tsx's header (same spacing/typography/
          layout hierarchy: avatar+camera-badge, name, one subtitle line,
          then a stats row) — ProviderProfileScreen.tsx itself is
          unchanged. Content below the photo is deliberately NOT identical
          (per the task): address instead of specialty/experience/rating,
          job/favorites counts instead of rating/reviews/jobs, and no
          availability-style status row (no Customer equivalent exists). */}
      <View style={styles.header}>
        <Text style={styles.title}>პროფილი</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            <Avatar initials={initials} color={colors.primary} size={72} />
            <Pressable style={styles.cameraBadge} onPress={() => handleMenuPress('photo')}>
              <Camera size={10} color={colors.primaryForeground} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {profile.firstName} {profile.lastName}
            </Text>
            <View style={styles.locationRow}>
              <MapPin size={12} color={colors.mutedForeground} />
              <Text style={styles.locationText}>{profile.defaultAddress}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{myJobsCount}</Text>
            <Text style={styles.statLabel}>მოთხოვნა</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{favoriteIds.size}</Text>
            <Text style={styles.statLabel}>შენახული ოსტატი</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {MENU.map((item) => (
          <ProfileMenuRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            iconBg={item.bg}
            iconColor={item.color}
            badge={item.badge}
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
        <Button testID="logout-confirm-button" label="გასვლა" variant="destructive" onPress={confirmLogout} />
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
  name: {
    ...typography.h3,
    color: colors.foreground,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  // Task 3 — same values as ProviderProfileScreen.tsx's statsRow/statBox/
  // statValue/statLabel (that file is unchanged; these are duplicated
  // here rather than shared, per the chosen "leave Provider Profile
  // untouched" approach).
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.sm + 2,
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
