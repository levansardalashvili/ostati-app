import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { RegionAreaAccordion } from './RegionAreaAccordion';
import { useRegions } from '../services/regionService';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  value: string;
  onChange: (district: string) => void;
  error?: boolean;
};

// განცხადების რაიონი/ქალაქი (0109) — იგივე სია, რასაც ოსტატი "სამუშაო არეალში" ირჩევს, ერთი არჩევანით.
export function DistrictPickerField({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const regions = useRegions();
  const region = regions.find((r) => r.districts.includes(value));
  return (
    <>
      <Pressable style={[styles.button, error && styles.error]} onPress={() => setOpen(true)}>
        <MapPin size={18} color={value ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value ? (region ? `${value}, ${region.label}` : value) : 'აირჩიეთ რაიონი/ქალაქი'}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.title}>რაიონი / ქალაქი</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <RegionAreaAccordion
            single
            selected={new Set(value ? [value] : [])}
            defaultExpanded={region ? [region.id] : ['tbilisi']}
            onToggleDistrict={(d) => {
              onChange(d);
              setOpen(false);
            }}
            onToggleAllInRegion={() => {}}
          />
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
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
  error: { borderColor: colors.destructive },
  text: { ...typography.caption, color: colors.foreground, fontWeight: '600', flex: 1 },
  placeholder: { color: colors.mutedForeground, fontWeight: '400' },
  title: { ...typography.h3, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md },
  list: { maxHeight: 460 },
});
