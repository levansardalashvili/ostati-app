import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Check, ChevronRight, Clock } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { colors, radius, spacing, typography } from '../theme';
import { EXPERIENCE_OPTIONS } from '../data/experience';

export type SelectedExperience = string | null;

type Props = {
  value: SelectedExperience;
  onChange: (value: string) => void;
};

// ExperiencePickerField — გამოცდილების dropdown (BottomSheet სია),
// თავისუფალი რიცხვის სტეპერის ნაცვლად (მომხმარებლის მოთხოვნით).
export function ExperiencePickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selectedLabel = EXPERIENCE_OPTIONS.find((o) => o.id === value)?.label ?? null;

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Clock size={16} color={colors.mutedForeground} />
        <Text style={[styles.fieldText, !selectedLabel && styles.fieldPlaceholder]} numberOfLines={1}>
          {selectedLabel ?? 'აირჩიე გამოცდილება'}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>გამოცდილება</Text>
        {EXPERIENCE_OPTIONS.map((o) => {
          const on = value === o.id;
          return (
            <Pressable key={o.id} style={styles.row} onPress={() => select(o.id)}>
              <Text style={styles.rowLabel}>{o.label}</Text>
              {on && <Check size={17} color={colors.primary} strokeWidth={2.5} />}
            </Pressable>
          );
        })}
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
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
});
