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
  Image as ImageIcon,
  MapPin,
  Shield,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTIES } from '../data/specialties';
import { TBILISI_AREAS } from '../data/districts';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PostJob'>;

const DATES = ['დღეს', 'ხვალ', 'ამ კვირაში', 'მოქნილი'];
const TIMES = ['9:00–12:00', '12:00–15:00', '15:00–18:00', '18:00–21:00', 'დრო არ აქვს'];
const URGENCIES = ['დღეს', '1–2 დღეში', 'ამ კვირაში', 'არ მეჩქარება'];
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<number[]>([]);
  // მისამართი წინასწარ ივსება პროფილის default address-ით, მაგრამ აქ
  // ცვლილება არასდროს არ სცვლის თავად default address-ს (მხოლოდ ამ
  // კონკრეტული job post-ის მისამართია) — მომხმარებლის მოთხოვნით.
  const [address, setAddress] = useState(profile.defaultAddress);
  const [district, setDistrict] = useState('');
  const [districtOpen, setDistrictOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [urgency, setUrgency] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);
  const [submitTouched, setSubmitTouched] = useState(false);

  const categoryError = submitTouched && !category ? 'აირჩიე კატეგორია' : '';
  const titleError = submitTouched && !title.trim() ? 'ეს ველი სავალდებულოა' : '';
  const descriptionError =
    submitTouched && description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN
      ? 'აღწერა ძალიან მოკლეა'
      : submitTouched && !description.trim()
        ? 'ეს ველი სავალდებულოა'
        : '';
  const districtError = submitTouched && !district ? 'აირჩიე რაიონი' : '';

  const canSubmit = !!category && title.trim().length > 0 && description.trim().length >= DESCRIPTION_MIN && !!district;

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
          <View style={{ gap: spacing.sm }}>
            {SPECIALTIES.map((sp) => {
              const on = category === sp.id;
              return (
                <Pressable
                  key={sp.id}
                  onPress={() => setCategory(sp.id)}
                  style={[styles.categoryOption, on && styles.categoryOptionSelected]}
                >
                  <Text style={styles.categoryIcon}>{sp.icon}</Text>
                  <Text style={[styles.categoryLabel, on && styles.categoryLabelSelected]}>{sp.label}</Text>
                  {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
                </Pressable>
              );
            })}
          </View>
          <FieldError message={categoryError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="რა სამუშაო გჭირდება?" required />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="მაგ. ონკანიდან წყალი ჟონავს"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, titleError && styles.inputError]}
          />
          <FieldError message={titleError} />
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
          <FieldLabel text="რაიონი" required />
          <Pressable
            style={[styles.districtButton, districtOpen && styles.districtButtonOpen, districtError && styles.inputError]}
            onPress={() => setDistrictOpen((o) => !o)}
          >
            <View style={styles.districtButtonLeft}>
              <MapPin size={16} color={colors.mutedForeground} />
              <Text style={district ? styles.districtValue : styles.districtPlaceholder}>
                {district || 'რაიონის არჩევა...'}
              </Text>
            </View>
            <ChevronRight
              size={16}
              color={colors.mutedForeground}
              style={{ transform: [{ rotate: districtOpen ? '90deg' : '0deg' }] }}
            />
          </Pressable>
          {districtOpen && (
            <View style={styles.districtDropdown}>
              {TBILISI_AREAS.map((d, i) => {
                const selected = district === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      setDistrict(d);
                      setDistrictOpen(false);
                    }}
                    style={[
                      styles.districtOption,
                      i > 0 && styles.districtOptionBorder,
                      selected && styles.districtOptionSelected,
                    ]}
                  >
                    <Text style={[styles.districtOptionText, selected && styles.districtOptionTextSelected]}>{d}</Text>
                    {selected && <Check size={15} color={colors.primary} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>
          )}
          <FieldError message={districtError} />
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი თარიღი" />
          <View style={styles.chipWrap}>
            {DATES.map((d) => (
              <ToggleChip key={d} label={d} selected={selectedDate === d} onPress={() => setSelectedDate(selectedDate === d ? '' : d)} />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel text="სასურველი დრო" />
          <View style={styles.chipWrap}>
            {TIMES.map((t) => (
              <ToggleChip key={t} label={t} selected={selectedTime === t} onPress={() => setSelectedTime(selectedTime === t ? '' : t)} />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel text="როდის გჭირდება?" />
          <View style={styles.urgencyGrid}>
            {URGENCIES.map((u) => (
              <View key={u} style={styles.urgencyItem}>
                <ToggleChip label={u} selected={urgency === u} onPress={() => setUrgency(urgency === u ? '' : u)} fullWidth />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.budgetLabelRow}>
            <Text style={styles.plainLabel}>სავარაუდო ბიუჯეტი</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>არასავალდ.</Text>
            </View>
          </View>
          <TextInput
            value={budget}
            onChangeText={setBudget}
            placeholder="მაგ. 80–120 ₾"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          <Text style={styles.hint}>ბიუჯეტი მხოლოდ საორიენტაციოა. საბოლოო ფასზე ოსტატთან ჩატში შეთანხმდები.</Text>
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}>
            <Shield size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.privacyText}>
              შენი ტელეფონი, ელ. ფოსტა და ზუსტი მისამართი ოსტატებისთვის ავტომატურად არ გამოჩნდება.
            </Text>
            <Text style={styles.privacyText}>კომუნიკაცია თავდაპირველად აპის ჩატში ხდება.</Text>
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

function ToggleChip({
  label,
  selected,
  onPress,
  fullWidth,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleChip, selected && styles.toggleChipSelected, fullWidth && styles.toggleChipFullWidth]}
    >
      <Text style={[styles.toggleChipText, selected && styles.toggleChipTextSelected]}>{label}</Text>
    </Pressable>
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
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  categoryIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  categoryLabel: {
    ...typography.captionMedium,
    color: colors.foreground,
    flex: 1,
  },
  categoryLabelSelected: {
    color: colors.secondaryForeground,
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
  districtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  districtButtonOpen: {
    borderColor: colors.primary,
  },
  districtButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  districtValue: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  districtPlaceholder: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  districtDropdown: {
    marginTop: spacing.sm - 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  districtOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  districtOptionBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.muted,
  },
  districtOptionSelected: {
    backgroundColor: colors.secondary,
  },
  districtOptionText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  districtOptionTextSelected: {
    color: colors.secondaryForeground,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  urgencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  urgencyItem: {
    width: '48%',
  },
  toggleChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  toggleChipFullWidth: {
    alignSelf: 'stretch',
  },
  toggleChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  toggleChipText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
  toggleChipTextSelected: {
    color: colors.secondaryForeground,
  },
  budgetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionalBadge: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  optionalBadgeText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
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
