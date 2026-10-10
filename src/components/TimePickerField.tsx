import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ChevronRight, Clock } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { WheelPicker } from './WheelPicker';
import { DEFAULT_TIME_SLOT, FLEXIBLE_SLOT, TIME_SLOT_OPTIONS, timeSlotLabel } from '../data/timeSlots';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  value: string; // შუალედის კოდი ('09-10' / 'flexible') ან ''
  onChange: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  testID?: string;
  placeholder?: string;
  disabledPlaceholder?: string;
  // სურვილისამებრ გარედან მართვა (მაგ. თარიღის არჩევისთანავე ავტომატურად გახსნა)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// TimePickerField — ველი + BottomSheet-ში ერთსაათიანი შუალედების „ბორბალი“ (WheelPicker). გამოიყენება განცხადების
// გამოქვეყნებაში და ოსტატთან პირველ მიწერაში (StartJobChatSheet). ბორბალზე არჩეული მნიშვნელობა მხოლოდ „დადასტურებით“ ინახება.
export function TimePickerField({
  value,
  onChange,
  disabled,
  error,
  testID,
  placeholder = 'აირჩიეთ დრო',
  disabledPlaceholder = 'ჯერ აირჩიეთ თარიღი',
  open: openProp,
  onOpenChange,
}: Props) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const [wheel, setWheel] = useState(value || DEFAULT_TIME_SLOT);
  // ყოველ გახსნაზე (გარედან გახსნისასაც) ბორბალი ამჟამინდელ არჩევანზე დგება — render-ში, რომ WheelPicker სწორი საწყისი მნიშვნელობით აიწყოს
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setWheel(value || DEFAULT_TIME_SLOT);
  }
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInnerOpen(v);
  };
  const label = timeSlotLabel(value);

  return (
    <>
      <Pressable testID={testID} style={[styles.field, disabled && styles.fieldDisabled, error && styles.fieldError]} disabled={disabled} onPress={() => setOpen(true)}>
        <Clock size={16} color={colors.mutedForeground} />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {label || (disabled ? disabledPlaceholder : placeholder)}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>სასურველი დრო</Text>
        <WheelPicker testID="time-wheel" items={TIME_SLOT_OPTIONS.map((t) => ({ value: t.code, label: t.label }))} value={wheel} onChange={setWheel} />
        <Button
          label="დადასტურება"
          testID="time-confirm-button"
          fullWidth
          onPress={() => {
            onChange(wheel);
            setOpen(false);
          }}
          style={{ marginTop: spacing.md }}
        />
        <Button
          label={FLEXIBLE_SLOT.label}
          testID="time-flexible-button"
          variant="outline"
          fullWidth
          onPress={() => {
            onChange(FLEXIBLE_SLOT.code);
            setOpen(false);
          }}
          style={{ marginTop: spacing.sm }}
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
  fieldDisabled: { opacity: 0.5 },
  fieldError: { borderColor: colors.destructive },
  fieldText: { ...typography.caption, color: colors.foreground, fontWeight: '600', flex: 1 },
  fieldPlaceholder: { color: colors.mutedForeground, fontWeight: '400' },
  sheetTitle: { ...typography.h3, color: colors.foreground, marginBottom: spacing.md },
});
