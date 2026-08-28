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
import { Camera, ChevronRight, MapPin, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { SpecialtyPickerField, type SelectedSpecialty } from '../components/SpecialtyPickerField';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderSetup'>;

const ABOUT_MAX = 300;

// A4 — პროფილის შევსება (Provider) (product-spec.md; დიზაინის რეფერენსის
// ProviderSetupScreen-ის მიხედვით)
export function ProviderSetupScreen({ navigation }: Props) {
  const [specialty, setSpecialty] = useState<SelectedSpecialty>(null);
  const [years, setYears] = useState(3);
  const [areas, setAreas] = useState<string[]>([]);
  const [about, setAbout] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  const canSave = !!specialty && areas.length > 0;

  const openAreaPicker = () => {
    navigation.navigate('RegionAreaPicker', {
      selected: areas,
      onSave: (next) => setAreas(next),
    });
  };

  const handleContinue = () => {
    if (!canSave) return;
    setLoading(true);
    // TODO: პროვაიდერის პროფილის შენახვა Firestore-ში
    setTimeout(() => {
      setLoading(false);
      navigation.reset({ index: 0, routes: [{ name: 'ProviderHome' }] });
    }, 1200);
  };

  const handleSkip = () => {
    // პროფილის შევსება მოგვიანებით შესაძლებელია პროფილის ეკრანიდან
    navigation.reset({ index: 0, routes: [{ name: 'ProviderHome' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <ProgressBar step={2} total={2} />
          <Pressable onPress={handleSkip}>
            <Text style={styles.skipText}>გამოტ.</Text>
          </Pressable>
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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>გამოცდილება</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setYears((y) => Math.max(0, y - 1))}
            >
              <Text style={styles.stepperButtonText}>–</Text>
            </Pressable>
            <View style={styles.stepperValue}>
              <Text style={styles.stepperValueText}>{years}</Text>
              <Text style={styles.stepperValueLabel}>წელი</Text>
            </View>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setYears((y) => Math.min(50, y + 1))}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>სამუშაო რაიონები</Text>
          <Text style={styles.sectionHint}>სად გინდა მუშაობა?</Text>
          <Pressable style={styles.areaPickerButton} onPress={openAreaPicker}>
            <MapPin size={16} color={colors.mutedForeground} />
            <Text style={styles.areaPickerButtonText} numberOfLines={1}>
              {areas.length > 0 ? areas.join(', ') : 'აირჩიე რაიონები'}
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
  skipText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  stepperValue: {
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
  },
  stepperValueLabel: {
    ...typography.small,
    color: colors.mutedForeground,
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
