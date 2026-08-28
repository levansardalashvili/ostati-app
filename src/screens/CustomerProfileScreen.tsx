import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Briefcase, Camera, HelpCircle, LogOut, MapPin, Pencil, Settings } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ProfileMenuRow } from '../components/ProfileMenuRow';
import { colors, radius, spacing, typography } from '../theme';
import { getUnreadCount } from '../data/mockNotifications';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MENU = [
  { icon: Briefcase, label: 'ჩემი მოთხოვნები', bg: '#EFF6FF', color: '#2563EB', badge: 3 },
  { icon: Pencil, label: 'პროფილის რედაქტირება', bg: '#F5F3FF', color: '#7C3AED', badge: 0 },
  { icon: Bell, label: 'შეტყობინებები', bg: '#FFFBEB', color: '#D97706', badge: getUnreadCount('customer') },
  { icon: HelpCircle, label: 'დახმარება', bg: '#ECFDF5', color: '#059669', badge: 0 },
  { icon: Settings, label: 'ანგარიშის პარამეტრები', bg: colors.muted, color: colors.mutedForeground, badge: 0 },
];

// E2 — Customer-ის პროფილის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// CustomerProfile-ის მიხედვით)
export function CustomerProfileScreen({ navigation }: Props) {
  const { profile } = useCustomerProfile();
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);

  const handleMenuPress = (label: string) => {
    if (label === 'ჩემი მოთხოვნები') {
      navigation.navigate('MyJobsTab');
    } else if (label === 'პროფილის რედაქტირება' || label === 'edit') {
      navigation.navigate('CustomerEditProfile');
    } else if (label === 'შეტყობინებები') {
      navigation.navigate('Notifications', { role: 'customer' });
    } else if (label === 'ანგარიშის პარამეტრები') {
      navigation.navigate('ProfileSettings');
    }
    // "დახმარება" — TODO: ეს ეკრანი ზიპშივე არ არსებობდა (screen: null)
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
            <Pressable style={styles.editButton} onPress={() => handleMenuPress('edit')}>
              <Pencil size={11} color={colors.primary} />
              <Text style={styles.editButtonText}>პროფილის რედაქტირება</Text>
            </Pressable>
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  editButtonText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '700',
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
