import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Shield,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { getCategoryIcon } from '../components/CategoryIcon';
import { DatePickerField } from '../components/DatePickerField';
import { formatPickedDate, toIsoDateString } from '../components/CalendarPicker';
import { InlineBanner } from '../components/InlineBanner';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { authService } from '../services/authService';
import { categoryService } from '../services/categoryService';
import { jobService } from '../services/jobService';
import { storageService } from '../services/storageService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { CategoryRecord } from '../types/category';
import type { CustomerJob, TimeSlot } from '../types/job';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PostJob'>;

// კოდი + ქართული ლეიბლი, ცალკე (supabase/migrations/0041-ის
// `job_posts_time_slot_check`-ის ზუსტი ანარეკლი) — არა თავისუფალი ტექსტი,
// რომ RPC-მ (`provider_request_completion`) რეალურად შეძლოს დაგეგმილი
// დროის სერვერზე ვალიდაცია.
const TIME_SLOTS: { code: TimeSlot; label: string }[] = [
  { code: '09-12', label: '9:00–12:00' },
  { code: '12-15', label: '12:00–15:00' },
  { code: '15-18', label: '15:00–18:00' },
  { code: '18-21', label: '18:00–21:00' },
  { code: 'flexible', label: 'ნებისმიერ დროს' },
];
// პროდუქტული წესი (product-spec.md) — job post-ში მაქს. 3 ფოტო,
// არა 5, როგორც დიზაინის რეფერენსშია
const MAX_PHOTOS = 3;
const DESCRIPTION_MAX = 500;
const DESCRIPTION_MIN = 20;

// C2 — Post a Job ფორმა (product-spec.md; დიზაინის რეფერენსის PostJob-ის
// მიხედვით, ფოტოს ლიმიტის override-ით 5-დან 3-მდე)
export function PostJobScreen({ navigation }: Props) {
  const { profile } = useCustomerProfile();
  const [category, setCategory] = useState('');
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [description, setDescription] = useState('');
  // ლოკალური ფაილის URI-ები (expo-image-picker-იდან) — რეალური thumbnail-ები,
  // ფერადი mock კვადრატების ნაცვლად. Supabase Storage-ში იტვირთება
  // "გამოქვეყნება"-ზე დაჭერისას (#61).
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  // მისამართი წინასწარ ივსება პროფილის default address-ით, მაგრამ აქ
  // ცვლილება არასდროს არ სცვლის თავად default address-ს (მხოლოდ ამ
  // კონკრეტული job post-ის მისამართია) — მომხმარებლის მოთხოვნით.
  const [address, setAddress] = useState(profile.defaultAddress);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<TimeSlot | ''>('');
  const selectedTimeLabel = TIME_SLOTS.find((t) => t.code === selectedTime)?.label ?? '';
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [submitTouched, setSubmitTouched] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [createdJob, setCreatedJob] = useState<CustomerJob | null>(null);
  // Third hardening pass, priority 2 — the created draft job, kept across
  // a failed retry. create_job() now creates a status='draft' row (never
  // visible to any Provider) instead of an immediately-published one, so
  // a retry after a photo-upload/finalize failure resumes THIS SAME job
  // instead of calling createCustomerJob() again — a network failure can
  // no longer produce two published jobs for one "გამოქვეყნება" tap.
  const [draftJob, setDraftJob] = useState<CustomerJob | null>(null);

  // Task 6 (audit) — კატეგორიების სია ახლა ბექენდიდანაა (`categories`
  // ცხრილი, supabase/migrations/0043): სახელი/რიგითობა/აქტიურობა
  // სანდოა backend-დან, `is_active=false` კატეგორია ამ სიაშივე აღარ
  // ჩანს (task: "inactive categories cannot be selected for new jobs").
  // საწყისი მნიშვნელობა `categoryService.getCached()`-ია (სტატიკური
  // fallback, სანამ backend-fetch არ დასრულდება/ჩავარდნისას) — ეკრანი
  // არასდროს ცარიელი/loading-ბლოკირებული არ დგება.
  const [categoryList, setCategoryList] = useState<CategoryRecord[]>(() => categoryService.getCached());
  useEffect(() => {
    let cancelled = false;
    categoryService
      .listCategories()
      .then((list) => {
        if (!cancelled) setCategoryList(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const activeCategories = [...categoryList].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  // bg/dot ფერები კვლავ ლოკალურია (`src/data/categories.ts`) — ეს
  // ვიზუალური/დიზაინის ტოკენებია, არა backend-მონაცემი (0043-ის სქემას
  // მათთვის სვეტი განზრახ არ აქვს).
  const selectedStyle = CATEGORIES.find((c) => c.id === category);

  const categoryError = submitTouched && !category ? 'აირჩიე კატეგორია' : '';
  const descriptionError =
    submitTouched && description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN
      ? 'აღწერა ძალიან მოკლეა'
      : submitTouched && !description.trim()
        ? 'ეს ველი სავალდებულოა'
        : '';
  // Second hardening pass, item 7 — მისამართი სავალდებულო ხდება (ადრე
  // საერთოდ არ მოწმდებოდა), და თარიღის არჩევისას დრო/'ნებისმიერ დროსაც'
  // სავალდებულოა (თარიღის გარეშე დროც არ მოწმდება — ორივე ერთად
  // ივსება/არცერთი, DatePickerField-ის arსებული UX-ის მიხედვით).
  const addressError = submitTouched && !address.trim() ? 'მისამართი სავალდებულოა' : '';
  const dateTimeError = submitTouched && !!selectedDate && !selectedTime ? 'აირჩიე სასურველი დრო' : '';
  const canSubmit =
    !!category && description.trim().length >= DESCRIPTION_MIN && !!address.trim() && (!selectedDate || !!selectedTime);
  const selectedCategory = activeCategories.find((c) => c.id === category) ?? null;
  const SelectedCategoryIcon = getCategoryIcon(selectedCategory?.id ?? '');

  const handlePublish = async () => {
    setSubmitTouched(true);
    if (!canSubmit || loading) return;
    setPublishError(false);
    setLoading(true);
    const uid = authService.getCurrentUser()?.uid;
    try {
      if (!uid) throw new Error('არ ხარ ავტორიზებული.');
      // Third hardening pass, priority 2 — idempotent publish. The job
      // row is created ONCE, as a draft (invisible to every Provider
      // read) — a retry after a later step fails resumes that SAME
      // draft (`draftJob`) instead of calling createCustomerJob() again,
      // so a network failure/retry can never create a duplicate
      // published job. Photos upload to `private-media/job/{jobId}/...`
      // (needs the job's id, which doesn't exist until the row does),
      // then finalizeJobPublish() flips draft -> pending — the only step
      // that actually makes the job visible to Providers. From the
      // user's side, "გამოქვეყნება" is still one action; a failed
      // mid-flow retry silently continues from wherever it left off.
      let job = draftJob;
      if (!job) {
        job = await jobService.createCustomerJob(uid, {
          category,
          description: description.trim(),
          address: address.trim(),
          date: selectedDate ? `${formatPickedDate(selectedDate)}${selectedTimeLabel ? ` ${selectedTimeLabel}` : ''}` : '',
          preferredDate: selectedDate ? toIsoDateString(selectedDate) : null,
          timeSlot: selectedTime || null,
        });
        setDraftJob(job);
      } else {
        // Resuming after a previous attempt failed client-side — but
        // finalizeJobPublish() may have actually SUCCEEDED server-side
        // before the response reached us (lost network response, app
        // backgrounded, etc.). Re-check the real state before doing
        // anything else: a draft can only have photos set once
        // (set_job_photos requires status='draft'), so blindly retrying
        // an already-finished publish would fail forever otherwise.
        const current = await jobService.getJobPostById(job.id);
        if (current && current.status !== 'draft') {
          setCreatedJob(current);
          setPublished(true);
          setLoading(false);
          return;
        }
      }
      if (photos.length > 0) {
        const photoRefs = await Promise.all(photos.map((uri) => storageService.uploadPrivateJobPhoto(job.id, uid, uri)));
        await jobService.setJobPhotos(job.id, photoRefs);
      }
      // finalize_job_publish() returns the up-to-date row (including any
      // photos just attached above) — no need to re-derive it client-side.
      const publishedJob = await jobService.finalizeJobPublish(job.id);
      setCreatedJob(publishedJob);
      setPublished(true);
    } catch {
      setPublishError(true);
    } finally {
      setLoading(false);
    }
  };

  const pickFromCamera = async () => {
    setPhotoError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPhotoError('კამერაზე წვდომა არ არის დაშვებული.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((ps) => [...ps, result.assets[0].uri]);
    }
  };
  const pickFromGallery = async () => {
    setPhotoError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoError('გალერეაზე წვდომა არ არის დაშვებული.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((ps) => [...ps, result.assets[0].uri]);
    }
  };
  const removePhoto = (uri: string) => setPhotos((ps) => ps.filter((p) => p !== uri));

  // თარიღის არჩევის შემდეგ მომხმარებელი პირდაპირ დროის არჩევაზე გადადის
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setTimeSheetOpen(true);
  };

  if (published) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successState}>
          <View style={styles.successIcon}>
            <CheckCircle size={40} color={colors.success} strokeWidth={1.8} />
          </View>
          <Text style={styles.successTitle}>მოთხოვნა გამოქვეყნებულია!</Text>
          <Text style={styles.successSubtitle}>შენი მოთხოვნა შესაბამის ოსტატებს უკვე შეუძლიათ ნახონ.</Text>
          <View style={styles.successActions}>
            <Button
              label="მოთხოვნის ნახვა"
              onPress={() => {
                if (!createdJob) return;
                navigation.navigate('CustomerJobDetail', { jobId: createdJob.id, job: createdJob });
              }}
            />
            <Button
              label="მთავარზე დაბრუნება"
              variant="outline"
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] })}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="მოთხოვნის გამოქვეყნება" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <FieldLabel text="კატეგორია" required />
          <Pressable
            style={[styles.categoryButton, categoryError && styles.inputError]}
            onPress={() => setCategorySheetOpen(true)}
          >
            <SelectedCategoryIcon
              size={18}
              color={selectedStyle ? selectedStyle.dot : colors.mutedForeground}
              strokeWidth={2}
            />
            <Text style={[styles.categoryButtonText, !selectedCategory && styles.categoryButtonPlaceholder]} numberOfLines={1}>
              {selectedCategory?.name ?? 'აირჩიე კატეგორია'}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
          <FieldError message={categoryError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სამუშაოს აღწერა" required />
          <TextInput
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX))}
            placeholder="დეტალურად აღწერე რა პრობლემაა და რა სამუშაოს შესრულება გჭირდება..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            style={[styles.textarea, descriptionError && styles.inputError]}
          />
          <View style={styles.descriptionFooter}>
            <FieldError message={descriptionError} />
            <Text style={styles.charCount}>
              {description.length}/{DESCRIPTION_MAX}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.plainLabel}>ფოტოების დამატება</Text>
          <Text style={styles.hint}>ფოტოები ოსტატს პრობლემის უკეთ შეფასებაში დაეხმარება.</Text>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImage} />
                <Pressable style={styles.photoRemove} onPress={() => removePhoto(uri)}>
                  <X size={10} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <Pressable style={styles.photoAddButton} onPress={pickFromCamera}>
                  <Camera size={18} color={colors.mutedForeground} />
                  <Text style={styles.photoAddText}>გადაღება</Text>
                </Pressable>
                <Pressable style={styles.photoAddButton} onPress={pickFromGallery}>
                  <ImageIcon size={18} color={colors.mutedForeground} />
                  <Text style={styles.photoAddText}>გალერეა</Text>
                </Pressable>
              </>
            )}
          </View>
          {!!photoError && <FieldError message={photoError} />}
        </View>

        <View style={styles.field}>
          <FieldLabel text="მისამართი" required />
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="მაგ. ვაკე, ჭავჭავაძის 45"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, addressError && styles.inputError]}
          />
          <Text style={styles.hint}>ავტომატურად შეივსო შენი მისამართით — შეგიძლია შეცვალო ამ მოთხოვნისთვის.</Text>
          <FieldError message={addressError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი თარიღი" />
          <DatePickerField value={selectedDate} onChange={handleDateSelect} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი დრო" />
          <Pressable
            style={[styles.categoryButton, !selectedDate && styles.categoryButtonDisabled, dateTimeError && styles.inputError]}
            disabled={!selectedDate}
            onPress={() => setTimeSheetOpen(true)}
          >
            <Clock size={16} color={colors.mutedForeground} />
            <Text style={[styles.categoryButtonText, !selectedTime && styles.categoryButtonPlaceholder]} numberOfLines={1}>
              {selectedTimeLabel || (selectedDate ? 'აირჩიე დრო' : 'ჯერ აირჩიე თარიღი')}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
          <FieldError message={dateTimeError} />
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <Shield size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.privacyText}>
              შენი ტელეფონი, ელ. ფოსტა და ზუსტი მისამართი ოსტატებისთვის ავტომატურად არ გამოჩნდება.
            </Text>
            <Text style={styles.privacyText}>
              ფასს ადგენს ოსტატი შენი აღწერისა და ფოტოების ნახვის შემდეგ — ის შემოგთავაზებს ფასს ჩატში, სადაც შეძლებ დათანხმებას ან უარყოფას.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {publishError && (
          <InlineBanner type="error" msg="მოთხოვნის გამოქვეყნება ვერ მოხერხდა" action="თავიდან ცდა" onAction={handlePublish} />
        )}
        <Button
          label={canSubmit ? 'გამოქვეყნება' : 'შეავსე სავალდებულო ველები'}
          loadingLabel="გამოქვეყნება..."
          onPress={handlePublish}
          disabled={!canSubmit}
          loading={loading}
        />
      </View>

      <BottomSheet visible={categorySheetOpen} onClose={() => setCategorySheetOpen(false)}>
        <Text style={styles.sheetTitle}>კატეგორია</Text>
        <ScrollView style={styles.categorySheetList} showsVerticalScrollIndicator={false}>
          {activeCategories.map((c) => {
            const on = category === c.id;
            const Icon = getCategoryIcon(c.id);
            const style = CATEGORIES.find((sc) => sc.id === c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCategory(c.id);
                  setCategorySheetOpen(false);
                }}
                style={styles.categorySheetRow}
              >
                <View style={styles.categoryIconWrap}>
                  <Icon size={18} color={style?.dot ?? colors.mutedForeground} strokeWidth={2} />
                </View>
                <Text style={[styles.categoryLabel, on && styles.categoryLabelSelected]}>{c.name}</Text>
                {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={timeSheetOpen} onClose={() => setTimeSheetOpen(false)}>
        <Text style={styles.sheetTitle}>სასურველი დრო</Text>
        {TIME_SLOTS.map((t) => {
          const on = selectedTime === t.code;
          return (
            <Pressable
              key={t.code}
              onPress={() => {
                setSelectedTime(t.code);
                setTimeSheetOpen(false);
              }}
              style={styles.categorySheetRow}
            >
              <Text style={[styles.categoryLabel, on && styles.categoryLabelSelected]}>{t.label}</Text>
              {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
            </Pressable>
          );
        })}
      </BottomSheet>
    </SafeAreaView>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.plainLabel}>
      {text}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );
}

function FieldError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow}>
      <AlertCircle size={11} color={colors.destructive} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  field: {},
  plainLabel: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  requiredMark: {
    color: colors.destructive,
  },
  hint: {
    ...typography.small,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  textarea: {
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  descriptionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  charCount: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  categoryButtonDisabled: {
    opacity: 0.5,
  },
  categoryButtonText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
    flex: 1,
  },
  categoryButtonPlaceholder: {
    color: colors.mutedForeground,
    fontWeight: '400',
  },
  categorySheetList: {
    maxHeight: 420,
  },
  categorySheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.sm + 2,
  },
  categoryIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
    flex: 1,
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.destructive,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddButton: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
    fontSize: 10,
  },
  privacyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  privacyIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm + 2,
  },
  successState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.successBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  successActions: {
    alignSelf: 'stretch',
    gap: spacing.sm + 2,
  },
});
