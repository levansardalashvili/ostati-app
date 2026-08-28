import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, Camera, ChevronRight, Image as ImageIcon, MapPin } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { ExperiencePickerField } from '../components/ExperiencePickerField';
import { InlineBanner } from '../components/InlineBanner';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import { MediaUploadGrid, nextMediaItem, type MediaItem } from '../components/MediaUploadGrid';
import { SpecialtyPickerField, type SpecialtyOption } from '../components/SpecialtyPickerField';
import { SqmPriceField } from '../components/SqmPriceField';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { isSqmPriced } from '../data/specialties';
import type { RootStackParamList } from '../navigation/types';

const INITIAL_CERTIFICATES: MediaItem[] = [{ id: 1, bg: '#DBEAFE' }];
const INITIAL_PORTFOLIO: MediaItem[] = [
  { id: 1, bg: '#D1FAE5' },
  { id: 2, bg: '#FEF3C7' },
  { id: 3, bg: '#FCE7F3' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderEditProfile'>;

// ProviderEditProfile — ზუსტად ზიპის App.tsx-ის ProviderEditProfile-ის
// მიხედვით. პირველი შენახვა შეგნებულად ვარდება (error-state
// დემონსტრირებისთვის), მეორე ცდაზე წარმატებული.
export function ProviderEditProfileScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('გიორგი');
  const [lastName, setLastName] = useState('ბერიძე');
  const [specialty, setSpecialty] = useState<SpecialtyOption[]>([{ id: 'plumber', label: 'სანტექნიკოსი' }]);
  const [areas, setAreas] = useState<string[]>(['ვაკე', 'საბურთალო', 'ვერა']);
  const [experience, setExperience] = useState<string | null>('10plus');
  const [about, setAbout] = useState(
    'ვარ სანტექნიკოსი 15 წლიანი გამოცდილებით. ვასრულებ ყველა სახის სანტექნიკის სამუშაოს სწრაფად და ხარისხიანად.',
  );
  const [certificates, setCertificates] = useState<MediaItem[]>(INITIAL_CERTIFICATES);
  const [portfolio, setPortfolio] = useState<MediaItem[]>(INITIAL_PORTFOLIO);
  const [previewCert, setPreviewCert] = useState<MediaItem | null>(null);
  const [previewPortfolio, setPreviewPortfolio] = useState<MediaItem | null>(null);
  const [sqmPrices, setSqmPrices] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const attemptRef = useRef(0);

  const sqmSpecialties = specialty.filter((s) => isSqmPriced(s.id));

  const firstNameErr = !firstName.trim() ? 'ეს ველი სავალდებულოა' : '';
  const lastNameErr = !lastName.trim() ? 'ეს ველი სავალდებულოა' : '';
  const canSave = firstName.trim().length > 0 && lastName.trim().length > 0 && specialty.length > 0 && areas.length > 0;

  const openAreaPicker = () => {
    navigation.navigate('RegionAreaPicker', {
      selected: areas,
      onSave: (next) => setAreas(next),
    });
  };

  const handleSave = () => {
    if (!canSave || isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      if (attemptRef.current === 0) {
        setSaveError(true);
        attemptRef.current += 1;
      } else {
        navigation.goBack();
      }
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="პროფილის რედაქტირება" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <Avatar initials={`${firstName.charAt(0)}${lastName.charAt(0)}`} color={colors.primary} size={88} />
            <Pressable style={styles.cameraBadge}>
              <Camera size={14} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: spacing.lg }}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <TextField label="სახელი" value={firstName} onChangeText={setFirstName} error={firstNameErr} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="გვარი" value={lastName} onChangeText={setLastName} error={lastNameErr} />
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>სპეციალობა</Text>
            <SpecialtyPickerField value={specialty} onChange={setSpecialty} />
          </View>

          {sqmSpecialties.length > 0 && (
            <View>
              <Text style={styles.fieldLabel}>ფასი კვ.მ-ზე</Text>
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

          <View>
            <Text style={styles.fieldLabel}>გამოცდილება</Text>
            <ExperiencePickerField value={experience} onChange={setExperience} />
          </View>

          <View>
            <Text style={styles.fieldLabel}>სამუშაო არეალი</Text>
            <Pressable style={styles.areaPickerButton} onPress={openAreaPicker}>
              <MapPin size={16} color={colors.mutedForeground} />
              <Text style={styles.areaPickerButtonText} numberOfLines={1}>
                {areas.length > 0 ? areas.join(', ') : 'აირჩიე არეალი'}
              </Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View>
            <Text style={styles.fieldLabel}>ჩემ შესახებ</Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="მოგვიყევი შენ შესახებ..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              style={styles.textarea}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>სერთიფიკატები</Text>
            <MediaUploadGrid
              items={certificates}
              icon={Award}
              onAdd={() => setCertificates((c) => [...c, nextMediaItem(c)])}
              onRemove={(id) => setCertificates((c) => c.filter((it) => it.id !== id))}
              onPreview={setPreviewCert}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>ნამუშევრების ფოტოები</Text>
            <MediaUploadGrid
              items={portfolio}
              icon={ImageIcon}
              onAdd={() => setPortfolio((p) => [...p, nextMediaItem(p)])}
              onRemove={(id) => setPortfolio((p) => p.filter((it) => it.id !== id))}
              onPreview={setPreviewPortfolio}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {saveError && (
          <InlineBanner type="error" msg="ცვლილებების შენახვა ვერ მოხერხდა" action="თავიდან ცდა" onAction={handleSave} />
        )}
        <Button label="ცვლილებების შენახვა" onPress={handleSave} disabled={!canSave} loading={isSaving} loadingLabel="ინახება..." />
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarWrap: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  fieldLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
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
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm + 2,
  },
});
