import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, DoorOpen } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Switch } from './Switch';
import { TextField } from './TextField';
import { colors, radius, spacing, typography } from '../theme';

export type AddressDetails = {
  entrance: string;
  apartment: string;
  doorCode: string;
  isPrivateHouse: boolean;
};

type Props = {
  address: string;
  value: AddressDetails;
  onChange: (value: AddressDetails) => void;
  // Task — ველი-ღილაკის წითელი ჩარჩო, თუ მშობელმა submit-ზე entrance
  // ცარიელად დატოვებული იპოვა (DistrictPickerField-ის იგივე კონვენცია).
  error?: boolean;
};

// შესასვლელი/ბინა/კარის კოდი — ინლაინ ველების ნაცვლად ცალკე BottomSheet-ში
// (მომხმარებლის მოთხოვნა, Bolt Food-ის "ახალი მისამართი" sheet-ის
// მაგალითით) — ველი-ღილაკი აჩვენებს შევსებულ შეჯამებას, დაჭერაზე იხსნება
// sheet მისამართის შეჯამებით + ველებით. "შესასვლელი" სავალდებულოა
// (მომხმარებლის მოთხოვნით — ოსტატს ეხმარება ზუსტი ადგილმდებარეობის
// დადგენაში), **გარდა** "კერძო სახლი" toggle-ის — კერძო სახლს შესასვლელი/
// ბინა არ გააჩნია, ამიტომ toggle-ის ჩართვაზე ორივე ველი იმალება და
// სავალდებულოობაც მოიხსნება. "ბინა"/"კარის კოდი" ორივე ყოველთვის
// არასავალდებულოა.
export function AddressDetailsField({ address, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AddressDetails>(value);

  const openSheet = () => {
    setDraft(value);
    setOpen(true);
  };

  const summary = value.isPrivateHouse
    ? ['კერძო სახლი', value.doorCode.trim() && `კოდი ${value.doorCode.trim()}`].filter(Boolean).join(', ')
    : [
        value.entrance.trim() && `შეს. ${value.entrance.trim()}`,
        value.apartment.trim() && `ბინა ${value.apartment.trim()}`,
        value.doorCode.trim() && `კოდი ${value.doorCode.trim()}`,
      ]
        .filter(Boolean)
        .join(', ');

  const canSave = draft.isPrivateHouse || (!!draft.entrance.trim() && !!draft.apartment.trim());

  const save = () => {
    if (!canSave) return;
    onChange({
      entrance: draft.isPrivateHouse ? '' : draft.entrance.trim(),
      apartment: draft.isPrivateHouse ? '' : draft.apartment.trim(),
      doorCode: draft.doorCode.trim(),
      isPrivateHouse: draft.isPrivateHouse,
    });
    setOpen(false);
  };

  return (
    <>
      <Text style={styles.fieldLabel}>მისამართის დეტალები</Text>
      <Pressable testID="address-details-button" style={[styles.field, error && styles.fieldError]} onPress={openSheet}>
        <DoorOpen size={16} color={colors.mutedForeground} />
        <Text style={[styles.fieldText, !summary && styles.fieldPlaceholder]} numberOfLines={1}>
          {summary || 'მიუთითეთ შესასვლელი'}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>მისამართის დეტალები</Text>
        <Text style={styles.sheetSubtitle}>ოსტატს დაეხმარება ზუსტი ადგილმდებარეობის დადგენაში</Text>
        {!!address && (
          <Text style={styles.addressSummary} numberOfLines={2}>
            {address}
          </Text>
        )}

        <View style={styles.privateRow}>
          <Text style={styles.privateRowLabel}>კერძო სახლია</Text>
          <Switch
            value={draft.isPrivateHouse}
            onValueChange={(v) => setDraft((d) => ({ ...d, isPrivateHouse: v }))}
            activeColor={colors.primary}
          />
        </View>

        {!draft.isPrivateHouse && (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="address-details-entrance"
                label="შესასვლელი"
                required
                value={draft.entrance}
                onChangeText={(v) => setDraft((d) => ({ ...d, entrance: v }))}
                placeholder="მაგ. 2"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID="address-details-apartment"
                label="ბინა"
                required
                value={draft.apartment}
                onChangeText={(v) => setDraft((d) => ({ ...d, apartment: v }))}
                placeholder="მაგ. 14"
              />
            </View>
          </View>
        )}

        <View style={styles.rowSingle}>
          <TextField
            label="კარის კოდი"
            value={draft.doorCode}
            onChangeText={(v) => setDraft((d) => ({ ...d, doorCode: v }))}
            placeholder="მაგ. 1234"
            keyboardType="number-pad"
          />
        </View>

        <Button testID="address-details-done-button" label="დასრულება" onPress={save} disabled={!canSave} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    ...typography.captionMedium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  field: {
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
  fieldError: {
    borderColor: colors.destructive,
  },
  fieldText: {
    ...typography.caption,
    color: colors.foreground,
    flex: 1,
  },
  fieldPlaceholder: {
    color: colors.mutedForeground,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  addressSummary: {
    ...typography.captionMedium,
    color: colors.foreground,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  privateRowLabel: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  rowSingle: {
    marginBottom: spacing.lg,
  },
});
