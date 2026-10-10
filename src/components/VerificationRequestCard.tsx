import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Clock, Shield, ShieldCheck, XCircle } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { ProfileCompletionRing } from './ProfileCompletionRing';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';
import { userService } from '../services/userService';
import {
  getVerificationEligibility,
  type ProviderProfileState,
} from '../state/ProviderProfileContext';

// Verification request card. Can only move unverified/rejected → pending via the RPC;
// never writes verification_status itself.
type Props = {
  profile: ProviderProfileState;
  onUpdated: (patch: Partial<ProviderProfileState>) => void;
  onEditProfile: () => void;
};

export function VerificationRequestCard({ profile, onUpdated, onEditProfile }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const status = profile.verificationStatus ?? 'unverified';
  const eligibility = getVerificationEligibility(profile);

  // Front-camera selfie; the admin compares it with the profile photo by hand.
  const takeSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('წვდომა საჭიროა', 'სელფის გადასაღებად საჭიროა კამერაზე წვდომა.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, cameraType: ImagePicker.CameraType.front });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setSelfieUri(result.assets[0].uri);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmOpen(false);
    setSelfieUri(null);
  };

  const submit = async () => {
    if (submitting || !selfieUri) return;
    setSubmitting(true);
    try {
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) throw new Error('not signed in');
      const selfiePath = await storageService.uploadPrivateVerificationSelfie(uid, selfieUri);
      await userService.requestProviderVerification(selfiePath);
      setConfirmOpen(false);
      setSelfieUri(null);
      // Re-read the real status; if that read fails, assume pending (the RPC succeeded).
      const fresh = await userService.getProviderProfileRecord(uid).catch(() => null);
      if (fresh) {
        onUpdated(fresh);
      } else {
        onUpdated({ verificationStatus: 'pending', verificationRequestedAt: new Date().toISOString(), verificationRejectionReason: null });
      }
    } catch (e) {
      const msg = (e as { message?: string } | null)?.message ?? '';
      Alert.alert(
        'ვერ მოხერხდა',
        msg.includes('PROFILE_INCOMPLETE')
          ? 'ჯერ შეავსე პროფილი: სახელი, გვარი, სპეციალობა, სამუშაო არეალი და პროფილის ფოტო.'
          : msg.includes('INVALID_SELFIE')
            ? 'სელფი ვერ აიტვირთა — გადაიღე ხელახლა და სცადე თავიდან.'
            : 'ვერიფიკაციის მოთხოვნა ვერ გაიგზავნა — სცადე თავიდან.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'verified') {
    return (
      <View style={[styles.card, styles.cardVerified]}>
        <View style={styles.iconCircleVerified}>
          <ShieldCheck size={20} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleVerified}>ვერიფიცირებული ოსტატი</Text>
        </View>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={[styles.card, styles.cardPending]}>
        <View style={styles.headerRow}>
          <View style={styles.iconCirclePending}>
            <Clock size={20} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titlePending}>ვერიფიკაცია განხილვის პროცესშია</Text>
            <Text style={styles.subtitle}>
              მოთხოვნა გაგზავნილია — შედეგს ვაცნობებთ. მანამდე ფასს ვერ შესთავაზებ.
            </Text>
          </View>
        </View>
        <Button label="განხილვის პროცესშია" onPress={() => {}} disabled variant="outline" />
      </View>
    );
  }

  // unverified / rejected
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={status === 'rejected' ? styles.iconCircleRejected : styles.iconCircleUnverified}>
          {status === 'rejected' ? (
            <XCircle size={20} color={colors.destructive} />
          ) : (
            <Shield size={20} color={colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {status === 'rejected' ? 'ვერიფიკაციის მოთხოვნა უარყოფილია' : 'გახდი ვერიფიცირებული ოსტატი'}
          </Text>
          <Text style={styles.subtitle}>
            {status === 'rejected'
              ? 'შეგიძლია ხელახლა გააგზავნო მოთხოვნა.'
              : 'ვერიფიკაციის გარეშე ფასს ვერ შესთავაზებ და მომხმარებლები ვერ მოგწერენ — გაიარე ახლავე.'}
          </Text>
        </View>
      </View>

      {status === 'rejected' && !!profile.verificationRejectionReason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>უარყოფის მიზეზი</Text>
          <Text style={styles.reasonText}>{profile.verificationRejectionReason}</Text>
        </View>
      )}

      {!eligibility.eligible && (
        <View style={styles.missingBox}>
          <ProfileCompletionRing percent={eligibility.percent} />
          <Pressable style={{ flex: 1 }} onPress={onEditProfile}>
            <Text style={styles.missingLink}>პროფილის რედაქტირება</Text>
          </Pressable>
        </View>
      )}

      <Button
        label={status === 'rejected' ? 'ხელახლა მოთხოვნა' : 'ვერიფიკაციის მოთხოვნა'}
        onPress={takeSelfie}
        disabled={!eligibility.eligible || submitting}
        loading={submitting}
        loadingLabel="იგზავნება..."
      />

      <BottomSheet visible={confirmOpen} onClose={closeConfirm}>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
        ) : (
          <View style={styles.confirmIcon}>
            <Shield size={22} color={colors.primary} />
          </View>
        )}
        <Text style={styles.sheetTitle}>ვერიფიკაციის მოთხოვნა</Text>
        <Text style={styles.sheetSubtitle}>
          სელფი გადაეცემა ადმინისტრაციას შესადარებლად შენს პროფილის ფოტოსთან. ნამდვილად გსურს გაგზავნა?
        </Text>
        <Button label="მოთხოვნის გაგზავნა" onPress={submit} loading={submitting} loadingLabel="იგზავნება..." />
        <Pressable style={styles.sheetCancelLink} onPress={takeSelfie} disabled={submitting}>
          <Text style={styles.sheetCancelLinkText}>თავიდან გადაღება</Text>
        </Pressable>
        <Pressable style={styles.sheetCancelLink} onPress={closeConfirm} disabled={submitting}>
          <Text style={styles.sheetCancelLinkText}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  cardVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.successBackground,
    borderColor: '#BBF7D0',
  },
  cardPending: {
    backgroundColor: colors.warningBackground,
    borderColor: '#FDE68A',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  iconCircleVerified: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePending: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnverified: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleRejected: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  titleVerified: {
    ...typography.captionMedium,
    color: '#065F46',
    fontWeight: '700',
  },
  titlePending: {
    ...typography.captionMedium,
    color: '#92400E',
    fontWeight: '700',
  },
  subtitle: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: 17,
  },
  reasonBox: {
    backgroundColor: colors.dangerBackground,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  reasonLabel: {
    ...typography.small,
    color: colors.destructive,
    fontWeight: '700',
    marginBottom: 2,
  },
  reasonText: {
    ...typography.caption,
    color: colors.foreground,
  },
  missingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.warningBackground,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  missingLink: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  confirmIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm + 2,
  },
  selfiePreview: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    alignSelf: 'center',
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.secondary,
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
