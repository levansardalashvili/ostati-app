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
import { Award, Camera, ChevronRight, Image as ImageIcon, MapPin, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { ExperiencePickerField } from '../components/ExperiencePickerField';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import { MediaUploadGrid, nextMediaItem, type MediaItem } from '../components/MediaUploadGrid';
import { ProgressBar } from '../components/ProgressBar';
import { SpecialtyPickerField, type SpecialtyOption } from '../components/SpecialtyPickerField';
import { SqmPriceField } from '../components/SqmPriceField';
import { colors, radius, spacing, typography } from '../theme';
import { isSqmPriced } from '../data/specialties';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderSetup'>;

const ABOUT_MAX = 300;

// A4 — პროფილის შევსება (Provider) (product-spec.md; დიზაინის რეფერენსის
// ProviderSetupScreen-ის მიხედვით)
export function ProviderSetupScreen({ navigation }: Props) {
  const { setProfile } = useProviderProfile();
  const [specialty, setSpecialty] = useState<SpecialtyOption[]>([]);
  const [experience, setExperience] = useState<string | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [about, setAbout] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [certificates, setCertificates] = useState<MediaItem[]>([]);
  const [portfolio, setPortfolio] = useState<MediaItem[]>([]);
  const [previewCert, setPreviewCert] = useState<MediaItem | null>(null);
  const [previewPortfolio, setPreviewPortfolio] = useState<MediaItem | null>(null);
  const [sqmPrices, setSqmPrices] = useState<Record<string, string>>({});

  // კვ.მ-ზე ფასიანი სპეციალობები, provider-ის შერჩეულთაგან — ერთი ველი
  // თითო სპეციალობაზე, საერთო მნიშვნელობის ნაცვლად (მომხმარებლის მოთხოვნით).
  const sqmSpecialties = specialty.filter((s) => isSqmPriced(s.id));

  // პროფილის შევსება სავალდებულოა — "გამოტოვება" შესაძლებლობა განზრახ
  // არ არსებობს (მომხმარებლის მოთხოვნით). სერთიფიკატები/ნამუშევრები
  // არასავალდებულოა და canSave-ს არ მოქმედებს.
  const canSave = specialty.length > 0 && areas.length > 0;

  const openAreaPicker = () => {
    navigation.navigate('RegionAreaPicker', {
      selected: areas,
      onSave: (next) => setAreas(next),
    });
  };

  const handleContinue = () => {
    if (!canSave) return;
    setLoading(true);
    // TODO: პროვაიდერის პროფილის საბოლოო შენახვა Firestore-ში — ჯერჯერობით
    // მხოლოდ ProviderProfileContext-ში (ლოკალური, არა persist).
    setTimeout(() => {
      setLoading(false);
      setProfile({ specialty, areas, experience, about, hasPhoto, certificates, portfolio, sqmPrices });
      navigation.reset({ index: 0, routes: [{ name: 'ProviderHome' }] });
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <ProgressBar step={2} total={2} />
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.title}>შექმენი ოსტატის პროფილი</Text>
        <Text style={styles.subtitle}>მომხმარებლები უკეთ გიპოვებენ.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.photoSection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {hasPhoto ? (
                <Text style={styles.avatarInitials}>ო</Text>
              ) : (
                <User size={32} color={colors.primary} />
              )}
            </View>
            <Pressable style={styles.cameraBadge} onPress={() => setHasPhoto((p) => !p)}>
              <Camera size={13} color={colors.primaryForeground} />
            </Pressable>
          </View>
          <View style={styles.photoActions}>
            <Pressable style={styles.photoActionButton} onPress={() => setHasPhoto(true)}>
              <Camera size={12} color={colors.mutedForeground} />
              <Text style={styles.photoActionText}>ფოტოს გადაღება</Text>
            </Pressable>
            <Pressable style={styles.photoActionButton} onPress={() => setHasPhoto(true)}>
              <User size={12} color={colors.mutedForeground} />
              <Text style={styles.photoActionText}>გალერეიდან არჩევა</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>სპეციალიზაცია</Text>
          <Text style={styles.sectionHint}>აირჩიე შენი ძირითადი პროფესია</Text>
          <SpecialtyPickerField value={specialty} onChange={setSpecialty} />
        </View>

        {sqmSpecialties.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ფასი კვ.მ-ზე</Text>
            <Text style={styles.sectionHint}>მიუთითე ფასი თითოეული სპეციალობისთვის ცალკე</Text>
            <View style={{ gap: spacing.sm + 2 }}>
              {sqmSpecialties.map((s) => (
                <SqmPriceField
                  key={s.id}
                  label={s.label}
                  value={sqmPrices[s.id] ?? ''}
                  onChangeText={(v) => setSqmPrices((prev) => ({ ...prev, [s.id]: v }))}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>გამოცდილება</Text>
          <ExperiencePickerField value={experience} onChange={setExperience} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>სამუშაო არეალი</Text>
          <Text style={styles.sectionHint}>სად გინდა მუშაობა?</Text>
          <Pressable style={styles.areaPickerButton} onPress={openAreaPicker}>
            <MapPin size={16} color={colors.mutedForeground} />
            <Text style={styles.areaPickerButtonText} numberOfLines={1}>
              {areas.length > 0 ? areas.join(', ') : 'აირჩიე არეალი'}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ჩემ შესახებ</Text>
          <TextInput
            value={about}
            onChangeText={(v) => setAbout(v.slice(0, ABOUT_MAX))}
            placeholder="მოკლედ აღწერე შენი გამოცდილება, სამუშაო სტილი..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />
          <Text style={styles.charCount}>
            {about.length}/{ABOUT_MAX}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>სერთიფიკატები</Text>
          <Text style={styles.sectionHint}>არასავალდებულო — ამაღლებს ნდობას მომხმარებელთან</Text>
          <MediaUploadGrid
            items={certificates}
            icon={Award}
            onAdd={() => setCertificates((c) => [...c, nextMediaItem(c)])}
            onRemove={(id) => setCertificates((c) => c.filter((it) => it.id !== id))}
            onPreview={setPreviewCert}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ნამუშევრების ფოტოები</Text>
          <Text style={styles.sectionHint}>არასავალდებულო — შესრულებული სამუშაოების მაგალითები</Text>
          <MediaUploadGrid
            items={portfolio}
            icon={ImageIcon}
            onAdd={() => setPortfolio((p) => [...p, nextMediaItem(p)])}
            onRemove={(id) => setPortfolio((p) => p.filter((it) => it.id !== id))}
            onPreview={setPreviewPortfolio}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="პროფილის შექმნა"
          loadingLabel="შენახვა..."
          onPress={handleContinue}
          disabled={!canSave}
          loading={loading}
        />
      </View>

      <MediaPreviewModal
        item={previewCert}
        icon={Award}
        onClose={() => setPreviewCert(null)}
        onDelete={(id) => setCertificates((c) => c.filter((it) => it.id !== id))}
      />
      <MediaPreviewModal
        item={previewPortfolio}
        icon={ImageIcon}
        onClose={() => setPreviewPortfolio(null)}
        onDelete={(id) => setPortfolio((p) => p.filter((it) => it.id !== id))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.xs / 2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  photoSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoActionText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  section: {},
  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginBottom: spacing.xs / 2,
  },
  sectionHint: {
    ...typography.small,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  areaPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  areaPickerButtonText: {
    ...typography.caption,
    color: colors.foreground,
    flex: 1,
  },
  textarea: {
    ...typography.body,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
