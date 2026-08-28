import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Calendar, ChevronRight } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { CalendarPicker, formatPickedDate } from './CalendarPicker';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
};

// DatePickerField — ველი + BottomSheet-ში ჩაშენებული CalendarPicker.
// თარიღზე დაჭერისას იხურება sheet (მოთხოვნა: "თარიღზე დაჭერისას გაიხსნას
// კალენდარი").
export function DatePickerField({ value, onChange, placeholder = 'აირჩიე თარიღი' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Calendar size={16} color={colors.mutedForeground} />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value ? formatPickedDate(value) : placeholder}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>თარიღის არჩევა</Text>
        <CalendarPicker
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
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
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
    flex: 1,
  },
  fieldPlaceholder: {
    color: colors.mutedForeground,
    fontWeight: '400',
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
});
