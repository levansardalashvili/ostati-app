import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AddressAutocompleteField } from './AddressAutocompleteField';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { getPublishErrorMessage, jobService } from '../services/jobService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { Provider } from '../types/provider';

const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 500;

type Props = {
  // `null` = დამალული. Provider-ის ცვლილება ("მიწერა"-ზე ხელახლა
  // დაჭერა სხვა ბარათზე) ავტომატურად უბრუნებს სვეტს საწყის state-ს
  // (იხ. ქვემოთ `useEffect`).
  provider: Provider | null;
  onClose: () => void;
  // ახლად შექმნილი+გამოქვეყნებული job-ის id, ან `null` (როცა ამ
  // Provider-თან საუბარი უკვე არსებობს — ახალი job აღარ იქმნება,
  // გამომძახებელი ჩატს ძველებურად, `jobId` route param-ის გარეშე ხსნის;
  // `ChatConversationScreen`-ის საკუთარი `findLatestSharedJobId` fallback
  // მაინც სცდის მისი "დეტ. ნახვა"-ს ბმულის ამოხსნას). მეორე პარამეტრი —
  // წინასწარშედგენილი პირველი შეტყობინების ტექსტი (ახალ job-ზე), რომ
  // Provider-მდე ცხადად მივიდეს "ეს კონკრეტულად თქვენთვისაა" — მხოლოდ
  // ჩატის composer-ში ივსება, არ იგზავნება.
  onReady: (jobId: string | null, draftMessage?: string) => void;
};

// ახალი, "ცივი" ჩატი (Provider-ის საჯარო პროფილიდან/"შენახული
// ოსტატებიდან" პირდაპირ "მიწერა", განცხადების გარეშე) აქამდე job_posts-ში
// არაფერს არ ტოვებდა კვალს — Customer-სა და Provider-ს შეეძლოთ მთლიანი
// ფასის შეთანხმება უბრალო ტექსტში ჩაეტარებინათ, job-ის რეალურად
// შექმნის/დასრულების/შეფასების ციკლის გვერდის ავლით (მოთხოვნა: "ეს
// სამუშაო რეალურად ხო არ შეუქმნია მომხმარებელს, ვერც შეფასებას
// დაუწერს"). Research (Thumbtack/TaskRabbit) — ორივეს საერთო პრინციპი,
// რომ ჩატი/შეთავაზება ყოველთვის კონკრეტულ posted request-ს/booking-ს
// უკავშირდება, არასდროს "უჩუმრად". ეს sheet ზუსტად ამ ხარვეზს ხურავს:
// "მიწერა"-ზე დაჭერისას (ან რეალურად ეძებს უკვე არსებულ, ჯერ-კიდევ-ღია
// საერთო job-ს (`findLatestSharedJobId`) — რომ ხელახალ "მიწერაზე" ყოველ
// ჯერზე ახალი, დუბლირებული job არ შეიქმნას — ან, თუ ვერაფერი მოიძებნა,
// მოკლე ფორმით (კატეგორია **აღარ ერჩევა** — ცხადია Provider-ის საკუთარი
// კატეგორიიდან, `Provider.category`, უკვე #60-ის მიხედვით სწორ
// CATEGORIES-id-ზეა map-ილი, ეს ჩატიც ხომ სწორედ ამ ერთ, კონკრეტულ
// Provider-ს ეხება — task: "ოსტატს ისედაც აქვს კატეგორია მითითებული";
// აღწერა 20+ სიმბოლო; მისამართი — Customer-ის პროფილის default-ით
// წინასწარშევსებული, მაგრამ **რედაქტირებადი** ამ ერთი job-ისთვის,
// `AddressAutocompleteField`-ით, PostJobScreen-ის იგივე UX) ქმნის და
// მაშინვე აქვეყნებს **რეალურ**, `create_job()`/`finalize_job_publish()`-ზე
// აგებულ job-ს (100% იგივე RPC-ები, რასაც PostJobScreen იყენებს) —
// ჩატი ამის შემდეგ **ყოველთვის** `jobId`-ითაა მიბმული, ისევე როგორც
// PostJob-იდან ან Job Feed-იდან წამოსული ჩატები, ასე რომ არსებული
// სტრუქტურირებული ფასის-შეთავაზების/დასრულების/შეფასების მთელი
// მექანიზმი (#2/#47/#92/#97-#98) ამ ნაკადზეც ავტომატურად, ცვლილების
// გარეშე მუშაობს.
export function StartJobChatSheet({ provider, onClose, onReady }: Props) {
  const { profile } = useCustomerProfile();
  const visible = !!provider;

  const [checking, setChecking] = useState(false);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [submitTouched, setSubmitTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Provider-ის ყოველ ახალ გახსნაზე — ჯერ ვამოწმებთ, ამ Provider-თან
  // საერთოდ არსებობს თუ არა ადრინდელი საუბარი (`hasExistingConversation`,
  // `messages`-ის (customer_id, provider_id) წყვილზე) — თუ დიახ, ვთვლით,
  // რომ job პირველივე "მიწერაზე" უკვე შეიქმნა და ახალ ფორმას აღარ
  // ვაჩვენებთ (მეორედ იგივე Provider-ისთვის "მიწერაზე" დაჭერისას ორმაგი,
  // დუბლირებული job რომ არ შეიქმნას). **განზრახ არ** ვცდილობთ იმ job-ის
  // ზუსტ id-ს (job_responses/`provider_id`-ზე დაფუძნებული
  // `findLatestSharedJobId` ისევ `false`-ს დააბრუნებდა, სანამ ამ job-ზე
  // Provider-ს რეალური პასუხი/მინიჭება არ ექნება) — უბრალოდ `jobId`
  // route param-ის გარეშე ვხსნით ჩატს, ისევე, როგორც ეს ბმული ადრეც
  // მუშაობდა (`ChatConversationScreen`-ის საკუთარი fallback ცდილობს
  // ამოხსნას მოგვიანებით, თუ/როცა შესაძლებელი გახდება).
  useEffect(() => {
    if (!provider) {
      setDescription('');
      setAddress('');
      setSubmitTouched(false);
      setSubmitError('');
      setChecking(false);
      return;
    }
    setDescription('');
    setAddress(profile.defaultAddress);
    setSubmitTouched(false);
    setSubmitError('');

    const uid = authService.getCurrentUser()?.uid;
    if (!uid) {
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
        // ვერაფრის პოვნა/ქსელის ჩავარდნა — უბრალოდ ახალი job-ის ფორმას
        // ვაჩვენებთ, კრიტიკული არაფერი არ დაკარგულა.
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
  const canSubmit = description.trim().length >= DESCRIPTION_MIN && !!address.trim();

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
      const job = await jobService.createCustomerJob(uid, {
        category: provider.category,
        description: description.trim(),
        address: address.trim(),
        date: '',
        preferredDate: null,
        timeSlot: null,
        invitedProviderId: provider.id,
      });
      const published = await jobService.finalizeJobPublish(job.id);
      // Provider-მდე job "ცხადად" რომ მივიდეს ("ეს job კონკრეტულად
      // თქვენთვისაა", არა ზოგადი "ახალი job თქვენს არეალში" ბრადქასტი) —
      // მომხმარებლის აშკარა მოთხოვნით ეს პირველი შეტყობინება ახლა
      // **რეალურად, ავტომატურად იგზავნება** (არა მხოლოდ წინასწარ ივსება
      // composer-ში) — ჩვეულებრივი ჩატის შეტყობინებაა, ამიტომ Provider-ს
      // ავტომატურად მიუვა push/in-app შეტყობინებაც (`handle_new_message`
      // trigger, უცვლელი). გაგზავნის ჩავარდნისას (ქსელი) job/ჩატი მაინც
      // იხსნება — `draftMessage`-ის fallback-ით composer-ში ვაცხოვნებთ
      // ტექსტს, რომ არაფერი არ დაიკარგოს.
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
