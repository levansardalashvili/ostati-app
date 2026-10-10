import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AddressAutocompleteField } from './AddressAutocompleteField';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { DistrictPickerField } from './DistrictPickerField';
import { DatePickerField } from './DatePickerField';
import { TimePickerField } from './TimePickerField';
import { formatPickedDate, toIsoDateString } from './CalendarPicker';
import { timeSlotLabel } from '../data/timeSlots';
import { guessDistrict } from '../data/georgiaRegions';
import { regionService } from '../services/regionService';
import { getPublishErrorMessage, jobService } from '../services/jobService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { Provider } from '../types/provider';

const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 500;

type Props = {
  // null = hidden; a different provider resets the form.
  provider: Provider | null;
  onClose: () => void;
  // jobId of the new job, or null when a conversation already exists (no new job).
  // draftMessage: the first message, returned only if sending it failed.
  onReady: (jobId: string | null, draftMessage?: string) => void;
  // Rehire: always create a new private job, even if a conversation exists.
  forceNew?: boolean;
};

// "მიწერა" to a provider: a chat must belong to a real job (else price, completion and
// rating would be bypassed). If no conversation exists yet, this short form creates and
// publishes a private job (same RPCs as PostJob; category = the provider's) and sends
// the first message.
export function StartJobChatSheet({ provider, onClose, onReady, forceNew = false }: Props) {
  const { profile } = useCustomerProfile();
  const visible = !!provider;

  const [checking, setChecking] = useState(false);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  // Date and time are required (as on PostJob).
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [timeOpen, setTimeOpen] = useState(false);
  const [submitTouched, setSubmitTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // An existing conversation means a job was already created on the first "მიწერა" —
  // open the chat without a new form (avoids duplicate jobs).
  useEffect(() => {
    if (!provider) {
      setDescription('');
      setAddress('');
      setDistrict('');
      setSelectedDate(null);
      setSelectedTime('');
      setSubmitTouched(false);
      setSubmitError('');
      setChecking(false);
      return;
    }
    setDescription('');
    setAddress(profile.defaultAddress);
    setDistrict(guessDistrict(profile.defaultAddress, regionService.getCached()));
    setSelectedDate(null);
    setSelectedTime('');
    setSubmitTouched(false);
    setSubmitError('');

    const uid = authService.getCurrentUser()?.uid;
    if (!uid || forceNew) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        const alreadyChatting = await chatService.hasExistingConversation(uid, provider.id);
        if (!cancelled && alreadyChatting) {
          onReady(null);
        }
      } catch {
        // Nothing found / network error → just show the form.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  const descriptionError =
    submitTouched && description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN
      ? `მინიმუმ ${DESCRIPTION_MIN} სიმბოლო`
      : submitTouched && !description.trim()
        ? 'ეს ველი სავალდებულოა'
        : '';
  const addressError = submitTouched && !address.trim() ? 'მისამართი სავალდებულოა' : '';
  const districtError = submitTouched && !district;
  const dateError = submitTouched && !selectedDate;
  const timeError = submitTouched && !!selectedDate && !selectedTime;
  const canSubmit = description.trim().length >= DESCRIPTION_MIN && !!address.trim() && !!district && !!selectedDate && !!selectedTime;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitTouched(true);
    if (!canSubmit || submitting || !provider) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) throw new Error('არ ხარ ავტორიზებული.');
      const job = await jobService.createCustomerJob({
        category: provider.category,
        description: description.trim(),
        address: address.trim(),
        date: selectedDate ? `${formatPickedDate(selectedDate)} ${timeSlotLabel(selectedTime)}`.trim() : '',
        preferredDate: selectedDate ? toIsoDateString(selectedDate) : null,
        timeSlot: selectedTime || null,
        invitedProviderId: provider.id,
      });
      await jobService.setJobDistrict(job.id, district);
      const published = await jobService.finalizeJobPublish(job.id);
      // Send the first message right away (triggers the provider's notification).
      // If it fails, the job and chat still open and the text stays in the composer.
      try {
        await chatService.sendRealMessage(
          uid,
          provider.id,
          uid,
          `გამარჯობა! დამჭირდა დახმარება — ${description.trim()}`,
          published.id,
        );
        onReady(published.id);
      } catch {
        onReady(published.id, `გამარჯობა! დამჭირდა დახმარება — ${description.trim()}`);
      }
    } catch (err) {
      setSubmitError(getPublishErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      {checking ? (
        <View style={styles.checkingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.checkingText}>მოწმდება...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sheetTitle}>რისი გაკეთება გჭირდებათ?</Text>
          <Text style={styles.sheetSubtitle}>
            {provider?.name ? `${provider.name}-სთან` : 'ოსტატთან'} მიწერამდე მოკლედ აღწერეთ სამუშაო - თქვენი სამუშაო გამოჩნდება მხოლოდ ამ ოსტატისთვის
          </Text>

          <Text style={styles.fieldLabel}>მოკლე აღწერა</Text>
          <TextInput
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX))}
            placeholder="მაგ: ნათურის შეცვლა საჭიროა სამზარეულოში..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={[styles.textarea, !!descriptionError && styles.textareaError]}
          />
          {!!descriptionError && <Text style={styles.errorText}>{descriptionError}</Text>}

          <View style={styles.addressField}>
            <DistrictPickerField value={district} onChange={setDistrict} error={districtError} />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>
            სასურველი თარიღი და დრო<Text style={{ color: colors.destructive }}> *</Text>
          </Text>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <DatePickerField
                testID="start-job-date"
                value={selectedDate}
                onChange={(d) => {
                  setSelectedDate(d);
                  setTimeOpen(true);
                }}
                placeholder="თარიღი"
                error={dateError}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimePickerField
                testID="start-job-time"
                value={selectedTime}
                onChange={setSelectedTime}
                disabled={!selectedDate}
                error={timeError}
                placeholder="დრო"
                disabledPlaceholder="დრო"
                open={timeOpen}
                onOpenChange={setTimeOpen}
              />
            </View>
          </View>

          <View style={styles.addressField}>
            <AddressAutocompleteField
              label="მისამართი"
              value={address}
              onChangeText={setAddress}
              placeholder="მაგ: ჭავჭავაძის 48"
              error={addressError}
            />
          </View>

          {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}

          <Button
            label="გაგზავნა"
            loadingLabel="იქმნება..."
            onPress={handleSubmit}
            disabled={submitTouched && !canSubmit}
            loading={submitting}
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  checkingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  checkingText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  textarea: {
    ...typography.caption,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm + 6,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  textareaError: {
    borderColor: colors.destructive,
  },
  errorText: {
    ...typography.small,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  addressField: {
    marginTop: spacing.sm + 2,
    marginBottom: spacing.md,
  },
});
