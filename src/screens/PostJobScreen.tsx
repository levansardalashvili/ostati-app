import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { DatePickerField } from '../components/DatePickerField';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PostJob'>;

const TIMES = ['9:00–12:00', '12:00–15:00', '15:00–18:00', '18:00–21:00', 'ნებისმიერ დროს'];
const PHOTO_BG = ['#DBEAFE', '#D1FAE5', '#FEF3C7'];
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
  const [photos, setPhotos] = useState<number[]>([]);
  // მისამართი წინასწარ ივსება პროფილის default address-ით, მაგრამ აქ
  // ცვლილება არასდროს არ სცვლის თავად default address-ს (მხოლოდ ამ
  // კონკრეტული job post-ის მისამართია) — მომხმარებლის მოთხოვნით.
  const [address, setAddress] = useState(profile.defaultAddress);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [submitTouched, setSubmitTouched] = useState(false);

  const categoryError = submitTouched && !category ? 'აირჩიე კატეგორია' : '';
  const descriptionError =
    submitTouched && description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN
      ? 'აღწერა ძალიან მოკლეა'
      : submitTouched && !description.trim()
        ? 'ეს ველი სავალდებულოა'
        : '';
  const canSubmit = !!category && description.trim().length >= DESCRIPTION_MIN;
  const selectedCategory = CATEGORIES.find((c) => c.id === category) ?? null;

  const handlePublish = () => {
    setSubmitTouched(true);
    if (!canSubmit || loading) return;
    setLoading(true);
    // TODO: jobPosts collection-ში ჩაწერა Firestore-ში
    setTimeout(() => {
      setLoading(false);
      setPublished(true);
    }, 1800);
  };

  const addPhoto = () => setPhotos((ps) => [...ps, Date.now() + ps.length]);
  const removePhoto = (id: number) => setPhotos((ps) => ps.filter((p) => p !== id));

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
              onPress={() =>
                // TODO: რეალურად შექმნილი job-ის id გადაეცემა, როცა Firestore-თან დაკავშირება მოხდება
                navigation.navigate('CustomerJobDetail', { jobId: 'j2' })
              }
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
            <Text style={styles.categoryButtonIcon}>{selectedCategory?.icon ?? '🛠️'}</Text>
            <Text style={[styles.categoryButtonText, !selectedCategory && styles.categoryButtonPlaceholder]} numberOfLines={1}>
              {selectedCategory?.label ?? 'აირჩიე კატეგორია'}
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
            {photos.map((id, i) => (
              <View key={id} style={[styles.photoThumb, { backgroundColor: PHOTO_BG[i % PHOTO_BG.length] }]}>
                <Camera size={20} color="rgba(100,116,139,0.5)" />
                <Pressable style={styles.photoRemove} onPress={() => removePhoto(id)}>
                  <X size={10} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <Pressable style={styles.photoAddButton} onPress={addPhoto}>
                  <Camera size={18} color={colors.mutedForeground} />
                  <Text style={styles.photoAddText}>გადაღება</Text>
                </Pressable>
                <Pressable style={styles.photoAddButton} onPress={addPhoto}>
                  <ImageIcon size={18} color={colors.mutedForeground} />
                  <Text style={styles.photoAddText}>გალერეა</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel text="მისამართი" />
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="მაგ. ვაკე, ჭავჭავაძის 45"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          <Text style={styles.hint}>ავტომატურად შეივსო შენი მისამართით — შეგიძლია შეცვალო ამ მოთხოვნისთვის.</Text>
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი თარიღი" />
          <DatePickerField value={selectedDate} onChange={handleDateSelect} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი დრო" />
          <Pressable
            style={[styles.categoryButton, !selectedDate && styles.categoryButtonDisabled]}
            disabled={!selectedDate}
            onPress={() => setTimeSheetOpen(true)}
          >
            <Clock size={16} color={colors.mutedForeground} />
            <Text style={[styles.categoryButtonText, !selectedTime && styles.categoryButtonPlaceholder]} numberOfLines={1}>
              {selectedTime || (selectedDate ? 'აირჩიე დრო' : 'ჯერ აირჩიე თარიღი')}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
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
          {CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setCategory(c.id);
                  setCategorySheetOpen(false);
                }}
                style={styles.categorySheetRow}
              >
                <Text style={styles.categoryIcon}>{c.icon}</Text>
                <Text style={[styles.categoryLabel, on && styles.categoryLabelSelected]}>{c.label}</Text>
                {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={timeSheetOpen} onClose={() => setTimeSheetOpen(false)}>
        <Text style={styles.sheetTitle}>სასურველი დრო</Text>
        {TIMES.map((t) => {
          const on = selectedTime === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                setSelectedTime(t);
                setTimeSheetOpen(false);
              }}
              style={styles.categorySheetRow}
            >
              <Text style={[styles.categoryLabel, on && styles.categoryLabelSelected]}>{t}</Text>
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
  categoryButtonIcon: {
    fontSize: 18,
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
  categoryIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
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
