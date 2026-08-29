import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  visible: boolean;
  price: string;
  onChangePrice: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting?: boolean;
};

// OfferPriceSheet — Provider-ის "დაინტერესების" ფასის prompt, ორიგინალად
// მხოლოდ ProviderJobDetailScreen-ზე იყო (#16); #72-ის მიხედვით ეს ფასი
// სავალდებულო, კონკრეტული რიცხვი გახდა (აღარ არის არასავალდებულო
// "თუ გინდა, მიუთითე"), ამიტომ Job Feed-ის ბარათების "დაინტ. ვარ"
// ერთი-შეხებით ღილაკსაც სჭირდება იგივე prompt (მანამდე ფასის გარეშე,
// პირდაპირ აგზავნიდა ინტერესს) — გატანილია საერთო კომპონენტად, რომ
// ProviderJobDetailScreen/ProviderHomeScreen/ProviderJobFeedScreen
// სამივემ ერთი და იგივე ვიზუალი გამოიყენონ.
export function OfferPriceSheet({ visible, price, onChangePrice, onSubmit, onClose, submitting }: Props) {
  const priceNum = Number(price);
  const valid = price.length > 0 && priceNum > 0;
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>დაინტერესების გაგზავნა</Text>
      <Text style={styles.sheetSubtitle}>მიუთითე კონკრეტული ფასი, რომლითაც ამ სამუშაოს შეასრულებდი.</Text>
      <Text style={styles.offerLabel}>ფასი</Text>
      <View style={styles.offerInputWrap}>
        <TextInput
          value={price}
          onChangeText={(v) => onChangePrice(v.replace(/[^0-9]/g, ''))}
          placeholder="ჩაწერეთ თანხა"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          style={styles.offerInput}
          autoFocus
        />
        <Text style={styles.offerSuffix}>₾</Text>
      </View>
      <Button
        label="დაინტერესების გაგზავნა"
        loadingLabel="იგზავნება..."
        onPress={onSubmit}
        disabled={!valid}
        loading={submitting}
      />
      <Pressable style={styles.sheetCancelLink} onPress={onClose}>
        <Text style={styles.sheetCancelLinkText}>გაუქმება</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  offerLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  offerInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  offerInput: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
    paddingVertical: spacing.md,
  },
  offerSuffix: {
    ...typography.bodyMedium,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  sheetCancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sheetCancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
});
