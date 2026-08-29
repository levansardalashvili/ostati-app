import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Clock, Shield, ShieldCheck, XCircle } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import {
  getVerificationEligibility,
  type ProviderProfileState,
} from '../state/ProviderProfileContext';

// Provider verification REQUEST card — Task 3. Status-aware section for
// ProviderProfileScreen, driven entirely by `provider_profiles.verification_status`
// (RLS-locked, supabase/migrations/0025) and the request metadata added in
// 0035. This card can only ever move unverified/rejected -> pending, via
// `userService.requestProviderVerification()` (SECURITY DEFINER RPC) — it
// never writes verification_status directly, and there is no path here for
// a Provider to set themselves 'verified' or clear a rejection.
type Props = {
  profile: ProviderProfileState;
  onUpdated: (patch: Partial<ProviderProfileState>) => void;
  onEditProfile: () => void;
};

export function VerificationRequestCard({ profile, onUpdated, onEditProfile }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const status = profile.verificationStatus ?? 'unverified';
  const eligibility = getVerificationEligibility(profile);

  const submit = async () => {
    if (submitting) return;
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await userService.requestProviderVerification();
      // წარმატების შემდეგ ჭეშმარიტი მდგომარეობა ბაზიდან ისევ იტვირთება
      // (task-ის მოთხოვნა — "refresh provider profile/status after
      // success"); თუ ეს კონკრეტული re-fetch ჩავარდა (RPC თავად მაინც
      // წარმატებით დასრულდა), ლოკალურად ვასახავთ იმას, რაც RPC-მ სერვერზე
      // უსათუოდ დაწერა — UI არასდროს არ რჩება ძველ, staleuc "unverified"/
      // "rejected" მდგომარეობაზე გაყინული.
      const uid = authService.getCurrentUser()?.uid;
      const fresh = uid ? await userService.getProviderProfileRecord(uid).catch(() => null) : null;
      if (fresh) {
        onUpdated(fresh);
      } else {
        onUpdated({ verificationStatus: 'pending', verificationRequestedAt: new Date().toISOString(), verificationRejectionReason: null });
      }
    } catch {
      Alert.alert('ვერ მოხერხდა', 'ვერიფიკაციის მოთხოვნა ვერ გაიგზავნა — სცადე თავიდან.');
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
          <Text style={styles.subtitle}>შენი ანგარიში დადასტურებულია — მომხმარებლები ხედავენ ვერიფიკაციის ბეჯს.</Text>
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
            <Text style={styles.subtitle}>მოთხოვნა გაგზავნილია — შედეგს ვაცნობებთ.</Text>
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
              : 'ვერიფიკაცია ზრდის მომხმარებლების ნდობას შენს პროფილში.'}
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
          <View style={styles.missingHeaderRow}>
            <AlertCircle size={15} color={colors.warning} />
            <Text style={styles.missingHeaderText}>დაასრულე პროფილი მოთხოვნამდე</Text>
          </View>
          <Text style={styles.missingListText}>{eligibility.missingLabels.join(', ')}</Text>
          <Pressable onPress={onEditProfile}>
            <Text style={styles.missingLink}>პროფილის რედაქტირება</Text>
          </Pressable>
        </View>
      )}

      <Button
        label={status === 'rejected' ? 'ხელახლა მოთხოვნა' : 'ვერიფიკაციის მოთხოვნა'}
        onPress={() => setConfirmOpen(true)}
        disabled={!eligibility.eligible || submitting}
        loading={submitting}
        loadingLabel="იგზავნება..."
      />

      <BottomSheet
        visible={confirmOpen}
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
      >
        <View style={styles.confirmIcon}>
          <Shield size={22} color={colors.primary} />
        </View>
        <Text style={styles.sheetTitle}>ვერიფიკაციის მოთხოვნა</Text>
        <Text style={styles.sheetSubtitle}>შენი პროფილი გადაეცემა განხილვას. ნამდვილად გსურს გაგზავნა?</Text>
        <Button label="მოთხოვნის გაგზავნა" onPress={submit} loading={submitting} loadingLabel="იგზავნება..." />
        <Pressable style={styles.sheetCancelLink} onPress={() => setConfirmOpen(false)}>
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
    backgroundColor: colors.warningBackground,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 4,
  },
  missingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missingHeaderText: {
    ...typography.small,
    color: colors.warning,
    fontWeight: '700',
  },
  missingListText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  missingLink: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
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
