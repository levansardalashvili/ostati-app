import { useEffect, useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm, ScrollAwareTextInput } from '../components/KeyboardAwareForm';
import { Image as ImageIcon, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { InlineBanner } from '../components/InlineBanner';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import { MediaUploadGrid, nextMediaItem, type MediaItem } from '../components/MediaUploadGrid';
import { SuccessCheck } from '../components/SuccessCheck';
import { Reveal } from '../components/Reveal';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { reviewService } from '../services/reviewService';
import { storageService } from '../services/storageService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RatingScreen'>;

const FEEDBACK_CHIPS = ['დროულად მოვიდა', 'კარგი კომუნიკაცია', 'ხარისხიანი სამუშაო', 'პროფესიონალი', 'სუფთად იმუშავა'];
const STAR_LABELS = ['', 'ძალიან ცუდი', 'ცუდი', 'საშუალო', 'კარგი', 'შესანიშნავი'];

// Mandatory rating: back is blocked until it is sent. onRate (from CustomerJobDetail)
// saves it; the review insert completes the job. Afterwards go to Customer Home.
export function RatingScreen({ navigation, route }: Props) {
  const { jobId, providerName, providerInitials, providerColor, providerId, onRate } = route.params;

  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<MediaItem | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (submitted) return;
      e.preventDefault();
    });
  }, [navigation, submitted]);

  const toggleChip = (c: string) => {
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const pickMedia = async (source: 'camera' | 'gallery') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { ...nextMediaItem(), uri: result.assets[0].uri }]);
    }
  };

  const handleSubmit = async () => {
    if (stars === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    const uid = authService.getCurrentUser()?.uid;
    let uploadedPhotos = photos;
    if (uid && photos.length > 0) {
      // allSettled: one failed photo must not drop the others.
      const results = await Promise.allSettled(
        photos.map(async (item) => {
          if (!item.uri || item.uri.startsWith('http') || storageService.isPrivateReference(item.uri)) {
            return item;
          }
          const privateReference = await storageService.uploadPrivateCompletionPhoto(jobId, uid, item.uri);
          return { ...item, uri: privateReference };
        }),
      );
      uploadedPhotos = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    }
    try {
      const data = { stars, review, chips, photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined };
      if (onRate) {
        await onRate(data);
      } else {
        // Opened by the launch-time pending-rating check (CustomerTabs), not
        // from CustomerJobDetail — submit directly.
        if (!uid || !providerId) throw new Error('rating: missing user or provider');
        await reviewService.submitReview(jobId, uid, providerId, data);
      }
    } catch {
      // Saving failed — no thank-you; keep the uploaded photos for the retry.
      setPhotos(uploadedPhotos);
      setSubmitError(true);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] });
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.doneWrap}>
          <SuccessCheck size={88} />
          <Reveal delay={420}>
            <Text style={styles.doneTitle}>მადლობა შეფასებისთვის!</Text>
          </Reveal>
          <Reveal delay={520}>
            <Text style={styles.doneSubtitle}>თქვენი მოსაზრება ეხმარება სხვა მომხმარებლებს სწორი ოსტატის არჩევაში.</Text>
          </Reveal>
          <View style={styles.doneStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Reveal key={s} delay={600 + s * 80} scaleFrom={0.4} from="none">
                <Star size={22} color="#FBBF24" fill={stars >= s ? '#FBBF24' : 'transparent'} />
              </Reveal>
            ))}
          </View>
          <Reveal delay={1100}>
            <Button label="მთავარზე დაბრუნება" onPress={goHome} />
          </Reveal>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ოსტატის შეფასება" onBack={() => navigation.goBack()} showBack={false} />
      {/* 'height' on Android: edge-to-edge makes the native resize a no-op. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <KeyboardAwareForm
        avoidKeyboard={false}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
        <View style={styles.providerCard}>
          <Avatar initials={providerInitials} color={providerColor} size={48} />
          <View>
            <Text style={styles.providerName}>{providerName}</Text>
            <Text style={styles.providerRole}>ოსტატი</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>შეაფასეთ სამუშაო</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} testID={`rating-star-${s}`} onPress={() => setStars(s)} hitSlop={4}>
                <Star size={38} color="#FBBF24" fill={stars >= s ? '#FBBF24' : 'transparent'} />
              </Pressable>
            ))}
          </View>
          {stars > 0 && <Text style={styles.starLabel}>{STAR_LABELS[stars]}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>სწრაფი შეფასება</Text>
          <View style={styles.chipsRow}>
            {FEEDBACK_CHIPS.map((c) => {
              const on = chips.includes(c);
              return (
                <Pressable key={c} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleChip(c)}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            დაწერეთ კომენტარი <Text style={styles.optionalText}>(სურვილისამებრ)</Text>
          </Text>
          <ScrollAwareTextInput
            value={review}
            onChangeText={setReview}
            placeholder="რა მოგეწონათ? რა შეიძლება გაუმჯობესდეს?..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            დასრულებული სამუშაოს ფოტო <Text style={styles.optionalText}>(სურვილისამებრ)</Text>
          </Text>
          <MediaUploadGrid
            items={photos}
            icon={ImageIcon}
            onAddCamera={() => pickMedia('camera')}
            onAddGallery={() => pickMedia('gallery')}
            onRemove={(id) => setPhotos((p) => p.filter((it) => it.id !== id))}
            onPreview={setPreviewPhoto}
          />
        </View>
        </KeyboardAwareForm>

        <View style={styles.footer}>
          {submitError && (
            <View style={{ marginBottom: spacing.sm }}>
              <InlineBanner type="error" msg="შეფასება ვერ გაიგზავნა" action="თავიდან ცდა" onAction={handleSubmit} />
            </View>
          )}
          <Button
            label="შეფასების გაგზავნა"
            loadingLabel="იგზავნება..."
            onPress={handleSubmit}
            disabled={stars === 0}
            loading={submitting}
          />
        </View>
      </KeyboardAvoidingView>

      <MediaPreviewModal
        item={previewPhoto}
        icon={ImageIcon}
        onClose={() => setPreviewPhoto(null)}
        onDelete={(id) => setPhotos((p) => p.filter((it) => it.id !== id))}
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
    gap: spacing.md,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  providerName: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  providerRole: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.sm + 2,
  },
  cardTitleCenter: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  starLabel: {
    ...typography.captionMedium,
    color: '#D97706',
    fontWeight: '700',
    textAlign: 'center',
  },
  optionalText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '400',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.sm,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  chipTextOn: {
    color: colors.primaryForeground,
  },
  textarea: {
    ...typography.caption,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 6,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  // Plain flex footer, not absolute.
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  doneIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.successBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  doneSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  doneStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.xl,
  },
});
