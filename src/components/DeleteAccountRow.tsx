import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { InlineBanner } from './InlineBanner';
import { authService } from '../services/authService';
import { colors, radius, spacing, typography } from '../theme';

// "ანგარიშის წაშლა" — მაღაზიების (Apple/Google) მოთხოვნაა: წაშლა აპიდანვე უნდა იწყებოდეს.
// ორივე Profile ეკრანზე ერთი და იგივე, გასვლის ღილაკის ქვემოთ. წარმატების შემდეგ onDeleted() Welcome-ზე გადაჰყავს.
export function DeleteAccountRow({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setError('');
  };

  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await authService.deleteAccount();
      setOpen(false);
      onDeleted();
    } catch (e) {
      const msg = (e as { message?: string } | null)?.message ?? '';
      setError(
        msg.includes('ACCOUNT_HAS_ACTIVE_JOBS')
          ? 'ჯერ დაასრულეთ ან გააუქმეთ მიმდინარე სამუშაოები, შემდეგ შეძლებთ ანგარიშის წაშლას.'
          : 'ანგარიშის წაშლა ვერ მოხერხდა. სცადეთ თავიდან.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Pressable testID="delete-account-row" style={styles.row} onPress={() => setOpen(true)}>
        <View style={styles.icon}>
          <Trash2 size={17} color={colors.destructive} />
        </View>
        <Text style={styles.text}>ანგარიშის წაშლა</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={close}>
        <View style={styles.sheetIcon}>
          <Trash2 size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>ანგარიშის წაშლა</Text>
        <Text style={styles.sheetSubtitle}>
          თქვენი პროფილი, ჩატები და შეფასებები სამუდამოდ წაიშლება. ეს მოქმედება ვერ გაუქმდება.
        </Text>
        {!!error && (
          <View style={{ marginBottom: spacing.sm }}>
            <InlineBanner type="error" msg={error} />
          </View>
        )}
        <Button
          testID="delete-account-confirm-button"
          label="სამუდამოდ წაშლა"
          loadingLabel="იშლება..."
          variant="destructive"
          onPress={confirm}
          loading={deleting}
        />
        <Pressable style={styles.cancelLink} onPress={close}>
          <Text style={styles.cancelLinkText}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.bodyMedium,
    color: colors.destructive,
  },
  sheetIcon: {
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
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
});
