import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Briefcase, Check, ChevronRight, X } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTIES } from '../data/specialties';

export type SpecialtyOption = { id: string; label: string };
export type SelectedSpecialty = SpecialtyOption[];

type Props = {
  value: SpecialtyOption[];
  onChange: (value: SpecialtyOption[]) => void;
};

const CUSTOM_PREFIX = 'custom:';

// SpecialtyPickerField — ოსტატის სპეციალობის მრავალარჩევანი dropdown
// (ველი + BottomSheet-ის checkbox სია), "სხვა" ვარიანტით — შეგიძლია
// დაამატო რამდენიმე თავისუფალი ტექსტის პროფესიაც, თუ ჩამონათვალში არ
// არის. Provider-ს შეუძლია რამდენიმე სპეციალობის არჩევა.
export function SpecialtyPickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const isSelected = (id: string) => value.some((v) => v.id === id);

  const toggle = (id: string, label: string) => {
    if (isSelected(id)) {
      onChange(value.filter((v) => v.id !== id));
    } else {
      onChange([...value, { id, label }]);
    }
  };

  const removeCustom = (id: string) => onChange(value.filter((v) => v.id !== id));

  const addCustom = () => {
    if (!customText.trim()) return;
    onChange([...value, { id: `${CUSTOM_PREFIX}${Date.now()}`, label: customText.trim() }]);
    setCustomText('');
    setShowCustomInput(false);
  };

  const customEntries = value.filter((v) => v.id.startsWith(CUSTOM_PREFIX));
  const summary = value.map((v) => v.label).join(', ');

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Briefcase size={16} color={colors.mutedForeground} />
        <Text style={[styles.fieldText, value.length === 0 && styles.fieldPlaceholder]} numberOfLines={1}>
          {value.length > 0 ? summary : 'აირჩიე სპეციალობა'}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>სპეციალობა</Text>
        <Text style={styles.sheetHint}>შეგიძლია აირჩიო რამდენიმე</Text>

        {SPECIALTIES.map((sp) => {
          const on = isSelected(sp.id);
          return (
            <Pressable key={sp.id} style={styles.row} onPress={() => toggle(sp.id, sp.label)}>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>
                {on && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rowIcon}>{sp.icon}</Text>
              <Text style={styles.rowLabel}>{sp.label}</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.row} onPress={() => setShowCustomInput((v) => !v)}>
          <View style={styles.checkbox} />
          <Text style={styles.rowIcon}>❓</Text>
          <Text style={styles.rowLabel}>სხვა</Text>
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
            <Button label="დამატება" onPress={addCustom} disabled={!customText.trim()} />
          </View>
        )}

        {customEntries.length > 0 && (
          <View style={styles.customChipRow}>
            {customEntries.map((c) => (
              <View key={c.id} style={styles.customChip}>
                <Text style={styles.customChipText}>{c.label}</Text>
                <Pressable onPress={() => removeCustom(c.id)} hitSlop={8}>
                  <X size={12} color={colors.secondaryForeground} strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.doneWrap}>
          <Button label="არჩევა" onPress={() => setOpen(false)} />
        </View>
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
    marginBottom: spacing.xs,
  },
  sheetHint: {
    ...typography.small,
    color: colors.mutedForeground,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    marginTop: spacing.sm + 2,
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
  customChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  customChipText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '600',
  },
  doneWrap: {
    marginTop: spacing.lg,
  },
});
