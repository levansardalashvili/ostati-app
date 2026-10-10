import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm, ScrollAwareTextInput } from '../components/KeyboardAwareForm';
import {
  AlertCircle,
  Plus,
  Check,
  ChevronRight,
  Shield,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { PhotoSourceSheet } from '../components/MediaUploadGrid';
import { Button } from '../components/Button';
import { getCategoryIcon } from '../components/CategoryIcon';
import { DatePickerField } from '../components/DatePickerField';
import { TimePickerField } from '../components/TimePickerField';
import { timeSlotLabel } from '../data/timeSlots';
import { formatPickedDate, toIsoDateString } from '../components/CalendarPicker';
import { SuccessCheck } from '../components/SuccessCheck';
import { Reveal } from '../components/Reveal';
import { InlineBanner } from '../components/InlineBanner';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { authService } from '../services/authService';
import { categoryService } from '../services/categoryService';
import { getPublishErrorMessage, jobService } from '../services/jobService';
import { storageService } from '../services/storageService';
import { DistrictPickerField } from '../components/DistrictPickerField';
import { guessDistrict } from '../data/georgiaRegions';
import { regionService } from '../services/regionService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { CategoryRecord } from '../types/category';
import type { CustomerJob, TimeSlot } from '../types/job';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PostJob'>;

const MAX_PHOTOS = 3;
const DESCRIPTION_MAX = 500;
const DESCRIPTION_MIN = 20;

// Create or edit (pending) a job post.
export function PostJobScreen({ navigation, route }: Props) {
  const { profile } = useCustomerProfile();
  const editJob = route.params?.editJob;
  const [category, setCategory] = useState(editJob?.category ?? '');
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [description, setDescription] = useState(editJob?.desc ?? '');
  // Local URIs; uploaded on publish.
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoError, setPhotoError] = useState('');
  // Prefilled from the profile; editing it here never changes the profile.
  const [address, setAddress] = useState(editJob?.address ?? profile.defaultAddress);
  const [district, setDistrict] = useState(editJob?.district ?? guessDistrict(editJob?.address ?? profile.defaultAddress, regionService.getCached()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const m = editJob?.preferredDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  });
  const [selectedTime, setSelectedTime] = useState<TimeSlot | ''>(editJob?.timeSlot ?? '');
  const selectedTimeLabel = timeSlotLabel(selectedTime);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [submitTouched, setSubmitTouched] = useState(false);
  // Specific text for permanent errors (see getPublishErrorMessage).
  const [publishError, setPublishError] = useState('');
  const [createdJob, setCreatedJob] = useState<CustomerJob | null>(null);
  // The draft from a failed attempt — a retry resumes it, so one tap never makes two jobs.
  const [draftJob, setDraftJob] = useState<CustomerJob | null>(null);

  // Active categories from the backend; cached/static list until loaded.
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
  // Colors are local design tokens, not backend data.
  const selectedStyle = CATEGORIES.find((c) => c.id === category);

  const categoryError = submitTouched && !category ? 'აირჩიეთ კატეგორია' : '';
  const descriptionError =
    submitTouched && description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN
      ? 'აღწერა ძალიან მოკლეა'
      : submitTouched && !description.trim()
        ? 'ეს ველი სავალდებულოა'
        : '';
  const addressError = submitTouched && !address.trim() ? 'მისამართი სავალდებულოა' : '';
  const districtError = submitTouched && !district;
  // თარიღი და დრო სავალდებულოა (ოსტატს უნდა ჰქონდეს კონკრეტული დაგეგმილი დრო; „ნებისმიერ დროს“ ცალკე არჩევანია)
  const dateError = submitTouched && !selectedDate ? 'აირჩიეთ სასურველი თარიღი' : '';
  const dateTimeError = submitTouched && !!selectedDate && !selectedTime ? 'აირჩიეთ სასურველი დრო' : '';
  const canSubmit =
    !!category && description.trim().length >= DESCRIPTION_MIN && !!address.trim() && !!district && !!selectedDate && !!selectedTime;
  const selectedCategory = activeCategories.find((c) => c.id === category) ?? null;
  const SelectedCategoryIcon = getCategoryIcon(selectedCategory?.id ?? '');

  const handlePublish = async () => {
    setSubmitTouched(true);
    if (!canSubmit || loading) return;
    setPublishError('');
    setLoading(true);
    const uid = authService.getCurrentUser()?.uid;
    try {
      if (!uid) throw new Error('არ ხართ ავტორიზებული.');
      if (editJob) {
        const updated = await jobService.updatePendingJob(editJob.id, {
          category,
          description: description.trim(),
          address: address.trim(),
          date: selectedDate ? `${formatPickedDate(selectedDate)}${selectedTimeLabel ? ` ${selectedTimeLabel}` : ''}` : '',
          preferredDate: selectedDate ? toIsoDateString(selectedDate) : null,
          timeSlot: selectedTime || null,
        });
        await jobService.setJobDistrict(updated.id, district);
        navigation.popTo('CustomerJobDetail', { jobId: updated.id, job: { ...updated, district } });
        return;
      }
      // Idempotent publish: create the draft once → upload photos (path needs the job id)
      // → set_job_photos → finalize (draft → pending). A retry continues from the same draft.
      const currentInput = {
        category,
        description: description.trim(),
        address: address.trim(),
        date: selectedDate ? `${formatPickedDate(selectedDate)}${selectedTimeLabel ? ` ${selectedTimeLabel}` : ''}` : '',
        preferredDate: selectedDate ? toIsoDateString(selectedDate) : null,
        timeSlot: selectedTime || null,
      };
      let job = draftJob;
      if (!job) {
        job = await jobService.createCustomerJob(currentInput);
        setDraftJob(job);
      } else {
        // The previous attempt may have published server-side even though we saw a failure — check first.
        const current = await jobService.getJobPostById(job.id);
        if (current && current.status !== 'draft') {
          setCreatedJob(current);
          setPublished(true);
          setLoading(false);
          return;
        }
        // Sync any edits made since the draft was created.
        job = await jobService.updateJobDraft(job.id, currentInput);
        setDraftJob(job);
      }
      // All-or-nothing upload: a retry re-uploads every photo, earlier copies stay orphaned
      // (ponytail: re-upload all; track per photo if storage cost matters).
      // set_job_photos always runs — even with zero photos — so removed photos don't get published.
      const photoRefs =
        photos.length > 0
          ? await Promise.all(photos.map((uri) => storageService.uploadPrivateJobPhoto(job.id, uid, uri)))
          : [];
      await jobService.setJobDistrict(job.id, district);
      await jobService.setJobPhotos(job.id, photoRefs);
      const publishedJob = await jobService.finalizeJobPublish(job.id);
      setCreatedJob(publishedJob);
      setPublished(true);
    } catch (err) {
      setPublishError(getPublishErrorMessage(err));
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
          <SuccessCheck size={92} />
          <Reveal delay={420}>
            <Text style={styles.successTitle}>მოთხოვნა გამოქვეყნებულია!</Text>
          </Reveal>
          <Reveal delay={520}>
            <Text style={styles.successSubtitle}>თქვენი მოთხოვნა შესაბამის ოსტატებს უკვე შეუძლიათ ნახონ.</Text>
          </Reveal>
          <Reveal delay={640} style={styles.successActions}>
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
          </Reveal>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Back is disabled while publishing — leaving mid-chain could publish a job
         the user never sees confirmed. */}
      <BackHeader title={editJob ? 'განცხადების რედაქტირება' : 'მოთხოვნის გამოქვეყნება'} onBack={() => !loading && navigation.goBack()} />

      {/* 'height' on Android: edge-to-edge makes the native resize a no-op. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <KeyboardAwareForm
        avoidKeyboard={false}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
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
              {selectedCategory?.name ?? 'აირჩიეთ კატეგორია'}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
          <FieldError message={categoryError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სამუშაოს აღწერა" required />
          <ScrollAwareTextInput
            testID="post-job-description"
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, DESCRIPTION_MAX))}
            placeholder="დეტალურად აღწერეთ რა პრობლემაა და რა სამუშაოს შესრულება გჭირდებათ..."
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

        {!editJob && (
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
              <Pressable testID="post-job-photo-add" style={styles.photoAddButton} onPress={() => setPhotoSheetOpen(true)}>
                <Plus size={18} color={colors.mutedForeground} />
                <Text style={styles.photoAddText}>დამატება</Text>
              </Pressable>
            )}
          </View>
          <PhotoSourceSheet
            visible={photoSheetOpen}
            onClose={() => setPhotoSheetOpen(false)}
            onCamera={() => {
              setPhotoSheetOpen(false);
              pickFromCamera();
            }}
            onGallery={() => {
              setPhotoSheetOpen(false);
              pickFromGallery();
            }}
          />
          {!!photoError && <FieldError message={photoError} />}
        </View>
        )}

        <View style={styles.field}>
          <FieldLabel text="რაიონი / ქალაქი" required />
          <DistrictPickerField value={district} onChange={setDistrict} error={districtError} />
          <FieldError message={districtError ? 'აირჩიეთ რაიონი ან ქალაქი' : ''} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="მისამართი" required />
          <ScrollAwareTextInput
            value={address}
            onChangeText={setAddress}
            placeholder="მაგ. ვაკე, ჭავჭავაძის 45"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, addressError && styles.inputError]}
          />
          <Text style={styles.hint}>ავტომატურად შეივსო თქვენი მისამართით — შეგიძლიათ შეცვალოთ ამ მოთხოვნისთვის.</Text>
          <FieldError message={addressError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი თარიღი" required />
          <DatePickerField value={selectedDate} onChange={handleDateSelect} error={!!dateError} />
          <FieldError message={dateError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი დრო" required />
          <TimePickerField
            value={selectedTime}
            onChange={setSelectedTime}
            disabled={!selectedDate}
            error={!!dateTimeError}
            open={timeSheetOpen}
            onOpenChange={setTimeSheetOpen}
          />
          <FieldError message={dateTimeError} />
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <Shield size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.privacyText}>
              თქვენი ადგილმდებარეობა ოსტატისთვის მიუწვდომელია, ოსტატთან შეთანხმებამდე.
            </Text>
            <Text style={styles.privacyText}>
              ფასს ადგენს ოსტატი თქვენი აღწერისა ან/და ფოტოების ნახვის შემდეგ - ოსტატი შემოგთავაზებთ ფასს ჩატში, სადაც შეძლებთ დათანხმებას ან უარყოფას.
            </Text>
          </View>
        </View>
      </KeyboardAwareForm>

      <View style={styles.footer}>
        {publishError && (
          <InlineBanner type="error" msg={publishError} action="თავიდან ცდა" onAction={handlePublish} />
        )}
        <Button
          label={canSubmit ? (editJob ? 'შენახვა' : 'გამოქვეყნება') : 'შეავსეთ სავალდებულო ველები'}
          loadingLabel={editJob ? 'ინახება...' : 'გამოქვეყნება...'}
          onPress={handlePublish}
          disabled={!canSubmit}
          loading={loading}
        />
      </View>
      </KeyboardAvoidingView>

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
