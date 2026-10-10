import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm, ScrollAwareTextInput } from '../components/KeyboardAwareForm';
import { Award, Camera, ChevronRight, Image as ImageIcon, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { ExperiencePickerField } from '../components/ExperiencePickerField';
import { InlineBanner } from '../components/InlineBanner';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import { MediaUploadGrid, PhotoSourceSheet, nextMediaItem, type MediaItem } from '../components/MediaUploadGrid';
import { SpecialtyPickerField, type SpecialtyOption } from '../components/SpecialtyPickerField';
import { SqmPriceField } from '../components/SqmPriceField';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { categoryService } from '../services/categoryService';
import { authService } from '../services/authService';
import { storageService, type UserMediaKind } from '../services/storageService';
import { userService } from '../services/userService';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderEditProfile'>;

// Edit the provider profile; seeded from ProviderProfileContext.
export function ProviderEditProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useProviderProfile();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [specialty, setSpecialty] = useState<SpecialtyOption[]>(profile.specialty);
  const [areas, setAreas] = useState<string[]>(profile.areas);
  const [experience, setExperience] = useState<string | null>(profile.experience);
  const [about, setAbout] = useState(profile.about);
  // Local or already uploaded URI; uploaded on save.
  const [photoUri, setPhotoUri] = useState<string | null>(profile.photoUrl ?? null);
  const [certificates, setCertificates] = useState<MediaItem[]>(profile.certificates);
  const [portfolio, setPortfolio] = useState<MediaItem[]>(profile.portfolio);
  const [previewCert, setPreviewCert] = useState<MediaItem | null>(null);
  const [previewPortfolio, setPreviewPortfolio] = useState<MediaItem | null>(null);
  const [sqmPrices, setSqmPrices] = useState<Record<string, string>>(profile.sqmPrices);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const sqmSpecialties = specialty.filter((s) => categoryService.isSqmPriced(s.id));

  const firstNameErr = !firstName.trim() ? 'ეს ველი სავალდებულოა' : '';
  const lastNameErr = !lastName.trim() ? 'ეს ველი სავალდებულოა' : '';
  const canSave = firstName.trim().length > 0 && lastName.trim().length > 0 && specialty.length > 0 && areas.length > 0;

  const openAreaPicker = () => {
    navigation.navigate('RegionAreaPicker', {
      selected: areas,
      onSave: (next) => setAreas(next),
    });
  };

  // Picked photos show immediately; upload happens on save.
  const pickMedia = async (source: 'camera' | 'gallery', setItems: React.Dispatch<React.SetStateAction<MediaItem[]>>) => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      // Tell the user — silently doing nothing looked like a broken button.
      Alert.alert(
        'წვდომა არ არის დაშვებული',
        source === 'camera' ? 'კამერაზე წვდომა საჭიროა ფოტოს გადასაღებად.' : 'გალერეაზე წვდომა საჭიროა ფოტოს ასარჩევად.',
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setItems((prev) => [...prev, { ...nextMediaItem(), uri: result.assets[0].uri }]);
    }
  };

  // Upload only new local photos, not already saved URLs.
  const uploadPendingMedia = async (uid: string, items: MediaItem[], kind: UserMediaKind): Promise<MediaItem[]> =>
    Promise.all(
      items.map(async (item) => {
        if (!item.uri || item.uri.startsWith('http')) return item;
        const url = await storageService.uploadUserMedia(uid, item.uri, kind);
        return { ...item, uri: url };
      }),
    );

  const pickProfilePhoto = async (source: 'camera' | 'gallery') => {
    setPhotoSheetOpen(false);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'წვდომა არ არის დაშვებული',
        source === 'camera' ? 'კამერაზე წვდომა საჭიროა ფოტოს გადასაღებად.' : 'გალერეაზე წვდომა საჭიროა ფოტოს ასარჩევად.',
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    const uid = authService.getCurrentUser()?.uid;
    let uploadedCerts = certificates;
    let uploadedPortfolio = portfolio;
    let uploadedPhotoUrl = photoUri ?? undefined;
    if (uid) {
      try {
        uploadedCerts = await uploadPendingMedia(uid, certificates, 'certificate');
        uploadedPortfolio = await uploadPendingMedia(uid, portfolio, 'portfolio');
        if (photoUri && !photoUri.startsWith('http')) {
          uploadedPhotoUrl = await storageService.uploadUserMedia(uid, photoUri, 'profile');
        }
        await userService.updateUserRecord(uid, { firstName, lastName });
        await userService.upsertProviderProfileRecord(uid, {
          firstName,
          lastName,
          specialty,
          areas,
          experience,
          about,
          photoUrl: uploadedPhotoUrl,
          certificates: uploadedCerts,
          portfolio: uploadedPortfolio,
          sqmPrices,
        });
      } catch {
        // The Context is already updated; a failed save doesn't block the UI.
      }
    }
    setProfile({
      firstName,
      lastName,
      specialty,
      areas,
      experience,
      about,
      photoUrl: uploadedPhotoUrl,
      certificates: uploadedCerts,
      portfolio: uploadedPortfolio,
      sqmPrices,
    });
    // Saving a new photo/name sends a verified profile back to review — refresh the status.
    const uidAfter = authService.getCurrentUser()?.uid;
    if (uidAfter) {
      const fresh = await userService.getProviderProfileRecord(uidAfter).catch(() => null);
      if (fresh) setProfile({ verificationStatus: fresh.verificationStatus });
    }
    setIsSaving(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="პროფილის რედაქტირება" onBack={() => navigation.goBack()} />
      {/* 'height' on Android: edge-to-edge makes the native resize a no-op. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <KeyboardAwareForm
        avoidKeyboard={false}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
        {profile.verificationStatus === 'verified' && (
          <InlineBanner
            type="warning"
            msg="ფოტოს ან სახელის შეცვლის შემდეგ ვერიფიკაციას ადმინისტრაცია ხელახლა გადაამოწმებს — მანამდე ფასს ვერ შესთავაზებ."
          />
        )}
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <Avatar
              initials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
              color={colors.primary}
              size={88}
              uri={photoUri ?? undefined}
            />
            <Pressable style={styles.cameraBadge} onPress={() => setPhotoSheetOpen(true)}>
              <Camera size={14} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>

        <PhotoSourceSheet
          visible={photoSheetOpen}
          onClose={() => setPhotoSheetOpen(false)}
          onCamera={() => pickProfilePhoto('camera')}
          onGallery={() => pickProfilePhoto('gallery')}
        />

        <View style={{ gap: spacing.lg }}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <TextField label="სახელი" value={firstName} onChangeText={setFirstName} error={firstNameErr} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField testID="provider-edit-last-name" label="გვარი" value={lastName} onChangeText={setLastName} error={lastNameErr} />
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>პროფესია</Text>
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
            <ScrollAwareTextInput
              value={about}
              onChangeText={setAbout}
              placeholder="მოკლედ აღწერეთ თქვენი გამოცდილება, სამუშაო სტილი..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              style={styles.textarea}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>სერთიფიკატები</Text>
            <MediaUploadGrid
              testID="provider-edit-certificates"
              items={certificates}
              icon={Award}
              onAddCamera={() => pickMedia('camera', setCertificates)}
              onAddGallery={() => pickMedia('gallery', setCertificates)}
              onRemove={(id) => setCertificates((c) => c.filter((it) => it.id !== id))}
              onPreview={setPreviewCert}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>ნამუშევრების ფოტოები</Text>
            <MediaUploadGrid
              testID="provider-edit-portfolio"
              items={portfolio}
              icon={ImageIcon}
              onAddCamera={() => pickMedia('camera', setPortfolio)}
              onAddGallery={() => pickMedia('gallery', setPortfolio)}
              onRemove={(id) => setPortfolio((p) => p.filter((it) => it.id !== id))}
              onPreview={setPreviewPortfolio}
            />
          </View>
        </View>
        </KeyboardAwareForm>

        <View style={styles.footer}>
          {saveError && (
            <InlineBanner type="error" msg="ცვლილებების შენახვა ვერ მოხერხდა" action="თავიდან ცდა" onAction={handleSave} />
          )}
          <Button label="ცვლილებების შენახვა" onPress={handleSave} disabled={!canSave} loading={isSaving} loadingLabel="ინახება..." />
        </View>
      </KeyboardAvoidingView>

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
    paddingBottom: spacing.xl,
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
  // Plain flex footer, not absolute — absolute covered the last content and broke keyboard avoidance.
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm + 2,
  },
});
