import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Star } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RatingScreen'>;

const FEEDBACK_CHIPS = ['დროულად მოვიდა', 'კარგი კომუნიკაცია', 'ხარისხიანი სამუშაო', 'პროფესიონალი', 'სუფთად იმუშავა'];
const STAR_LABELS = ['', 'ძალიან ცუდი', 'ცუდი', 'საშუალო', 'კარგი', 'შესანიშნავი'];

// RatingScreen — "ოსტატის შეფასება" (ზუსტად ზიპის App.tsx-ის RatingScreen-ის
// მიხედვით). დათანხმებული შეფასება navigation param-ით მოწოდებული `onRate`
// callback-ით ბრუნდება CustomerJobDetailScreen-ში (Firebase-მდე — TODO).
export function RatingScreen({ navigation, route }: Props) {
  const { providerName, providerInitials, providerColor, onRate } = route.params;

  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggleChip = (c: string) => {
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSubmit = () => {
    if (stars === 0) return;
    onRate?.({ stars, review, chips });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <CheckCircle size={38} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>მადლობა შეფასებისთვის!</Text>
          <Text style={styles.doneSubtitle}>შენი მოსაზრება ეხმარება სხვა მომხმარებლებს სწორი ოსტატის არჩევაში.</Text>
          <View style={styles.doneStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={22} color="#FBBF24" fill={stars >= s ? '#FBBF24' : 'transparent'} />
            ))}
          </View>
          <Button label="დახურვა" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ოსტატის შეფასება" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.providerCard}>
          <Avatar initials={providerInitials} color={providerColor} size={48} />
          <View>
            <Text style={styles.providerName}>{providerName}</Text>
            <Text style={styles.providerRole}>ოსტატი</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>შეაფასე სამუშაო</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => setStars(s)} hitSlop={4}>
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
            დაწერე კომენტარი <Text style={styles.optionalText}>(სურვილისამებრ)</Text>
          </Text>
          <TextInput
            value={review}
            onChangeText={setReview}
            placeholder="რა მოგეწონა? რა შეიძლება გაუმჯობესდეს?..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="შეფასების გაგზავნა" onPress={handleSubmit} disabled={stars === 0} />
      </View>
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
