import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Briefcase, Check, ChevronRight } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTIES } from '../data/specialties';

export type SelectedSpecialty = { id: string; label: string } | null;

type Props = {
  value: SelectedSpecialty;
  onChange: (value: SelectedSpecialty) => void;
};

const OTHER_ID = 'other';

// SpecialtyPickerField — ოსტატის სპეციალობის dropdown-ის მსგავსი არჩევა
// (ველი + BottomSheet-ის სია), "სხვა" ვარიანტით და თავისუფალი ტექსტის
// ველით, თუ პროფესია ჩამონათვალში არ არის.
export function SpecialtyPickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState(value?.id === OTHER_ID ? value.label : '');
  const [showCustomInput, setShowCustomInput] = useState(value?.id === OTHER_ID);

  const openSheet = () => {
    setShowCustomInput(value?.id === OTHER_ID);
    setCustomText(value?.id === OTHER_ID ? value.label : '');
    setOpen(true);
  };

  const selectSpecialty = (id: string, label: string) => {
    onChange({ id, label });
    setOpen(false);
  };

  const confirmCustom = () => {
    if (!customText.trim()) return;
    onChange({ id: OTHER_ID, label: customText.trim() });
    setOpen(false);
  };

  return (
    <>
      <Pressable style={styles.field} onPress={openSheet}>
        <Briefcase size={16} color={colors.mutedForeground} />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value ? value.label : 'აირჩიე სპეციალობა'}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>სპეციალობა</Text>
        {SPECIALTIES.map((sp) => {
          const on = value?.id === sp.id;
          return (
            <Pressable key={sp.id} style={styles.row} onPress={() => selectSpecialty(sp.id, sp.label)}>
              <Text style={styles.rowIcon}>{sp.icon}</Text>
              <Text style={styles.rowLabel}>{sp.label}</Text>
              {on && <Check size={17} color={colors.primary} strokeWidth={2.5} />}
            </Pressable>
          );
        })}
        <Pressable
          style={styles.row}
          onPress={() => {
            setShowCustomInput(true);
          }}
        >
          <Text style={styles.rowIcon}>❓</Text>
          <Text style={styles.rowLabel}>სხვა</Text>
          {value?.id === OTHER_ID && <Check size={17} color={colors.primary} strokeWidth={2.5} />}
        </Pressable>

        {showCustomInput && (
          <View style={styles.customWrap}>
            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="მიუთითე შენი პროფესია"
              placeholderTextColor={colors.mutedForeground}
              style={styles.customInput}
              autoFocus
            />
            <Button label="არჩევა" onPress={confirmCustom} disabled={!customText.trim()} />
          </View>
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  rowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  rowLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
    flex: 1,
  },
  customWrap: {
    marginTop: spacing.md,
    gap: spacing.sm + 2,
  },
  customInput: {
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
