import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';
import { reportService, type ReportReason } from '../services/reportService';
import type { Role } from '../types/user';

// ReportJobSheet — ზოგადი "პრობლემის შეტყობინება" (moderation report,
// #84), **არა** completion-dispute flow-ის ("პრობლემა მაქვს",
// CustomerJobDetailScreen-ის `submitProblem`/`customer_report_problem`,
// #72) ჩანაცვლება ან დუბლირება — ეს ორი განზრახ, ლოგიკურად ცალკეა:
// completion-dispute job-ის workflow/status-ის საკითხია (მხოლოდ
// Customer-ის მხრიდან, მხოლოდ `awaiting_customer_confirmation`-ზე,
// job-ის სტატუსს ცვლის — `disputed`), ეს კი moderation-ის საკითხია
// (job_reports-ში ინახება, job-ის სტატუსს არასდროს არ ცვლის, #81-ის
// `create_job_report` RPC). გაზიარებულია Customer-ისა და Provider-ის
// ორივე Job Detail ეკრანს შორის (მოთხოვნა #9 — კოდის დუბლირების
// თავიდან ასაცილებლად) — role-ის მიხედვით საკუთარ თავზე no-show-ის
// ვარიანტს არ აჩვენებს (Customer-ს არ ეჩვენება "მომხმარებელი არ
// გამოცხადდა", Provider-ს — "ოსტატი არ გამოცხადდა").
const CUSTOMER_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'provider_no_show', label: 'ოსტატი არ გამოცხადდა' },
  { value: 'work_not_completed', label: 'სამუშაო არ დასრულდა' },
  { value: 'inappropriate_behavior', label: 'არასათანადო ქცევა' },
  { value: 'incorrect_information', label: 'არასწორი ინფორმაცია' },
  { value: 'other', label: 'სხვა' },
];

const PROVIDER_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'customer_no_show', label: 'მომხმარებელი არ გამოცხადდა / ვერ დავუკავშირდი' },
  { value: 'work_not_completed', label: 'სამუშაო არ დასრულდა' },
  { value: 'inappropriate_behavior', label: 'არასათანადო ქცევა' },
  { value: 'incorrect_information', label: 'არასწორი ინფორმაცია' },
  { value: 'other', label: 'სხვა' },
];

type Props = {
  visible: boolean;
  jobId: string;
  role: Role;
  onClose: () => void;
};

export function ReportJobSheet({ visible, jobId, role, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = role === 'customer' ? CUSTOMER_REASONS : PROVIDER_REASONS;
  const detailsRequired = reason === 'other';
  const canSubmit = !!reason && (!detailsRequired || details.trim().length > 0);

  // ყოველ ახალ გახსნაზე სუფთა state — `visible`-ზე დამოკიდებული
  // `useEffect`-ით (არა `setTimeout`-ით close-ის შემდეგ), რომ სწრაფი
  // "დახურვა → ისევ გახსნა" (300ms-ზე ნაკლებში) ძველ, ჯერ კიდევ
  // მოლოდინში მდგარ reset-ს არ "წაეშალოს" მომხმარებლის ახალი არჩევანი.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
      setSubmitted(false);
    }
  }, [visible]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async () => {
    if (!reason || submitting || !canSubmit) return;
    setSubmitting(true);
    try {
      await reportService.submitJobReport(jobId, reason, details.trim() || undefined);
      setSubmitted(true);
    } catch {
      Alert.alert('ვერ მოხერხდა', 'რეპორტის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      {submitted ? (
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <CheckCircle size={26} color={colors.success} />
          </View>
          <Text style={styles.sheetTitle}>რეპორტი მიღებულია</Text>
          <Text style={styles.sheetSubtitle}>მადლობა შეტყობინებისთვის — მალე განვიხილავთ.</Text>
          <Button label="დახურვა" onPress={handleClose} />
        </View>
      ) : (
        <>
          <Text style={styles.sheetTitle}>პრობლემის შეტყობინება</Text>
          <Text style={styles.sheetSubtitle}>ეს რეპორტი მოდერაციას გადაეცემა და არ ცვლის სამუშაოს სტატუსს.</Text>
          {reasons.map((opt) => {
            const on = reason === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => setReason(opt.value)}
              >
                <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                  {on && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.detailsLabel}>
            დამატებითი ინფორმაცია{detailsRequired ? ' (სავალდებულო)' : ' (არასავალდებულო)'}
          </Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="დაწერე დეტალები..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={styles.textarea}
          />
          <Button
            label="რეპორტის გაგზავნა"
            loadingLabel="იგზავნება..."
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
          />
          <Pressable style={styles.cancelLink} onPress={handleClose}>
            <Text style={styles.cancelLinkText}>გაუქმება</Text>
          </Pressable>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
    marginBottom: spacing.sm,
  },
  optionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  optionText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
    flexShrink: 1,
  },
  optionTextOn: {
    color: colors.secondaryForeground,
  },
  detailsLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  textarea: {
    ...typography.caption,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 6,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.successBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
