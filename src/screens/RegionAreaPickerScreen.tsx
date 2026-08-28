import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { RegionAreaAccordion } from '../components/RegionAreaAccordion';
import { colors, spacing, typography } from '../theme';
import { GEORGIA_REGIONS } from '../data/georgiaRegions';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RegionAreaPicker'>;

// RegionAreaPicker — საქართველოს მხარეების/რაიონების არჩევა (ოსტატის
// სამუშაო ტერიტორია), გამოძახებული ProviderSetup-ის რეგისტრაციის
// ფორმიდან callback-ის საშუალებით (myhome.ge-ის მდებარეობის picker-ის
// მსგავსი ინტერაქციით — მომხმარებლის მოწოდებული screenshot-ების მიხედვით).
export function RegionAreaPickerScreen({ navigation, route }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(route.params.selected));

  const toggleDistrict = (district: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(district) ? next.delete(district) : next.add(district);
      return next;
    });
  };

  const toggleAllInRegion = (regionId: string) => {
    const region = GEORGIA_REGIONS.find((r) => r.id === regionId);
    if (!region) return;
    const allSelected = region.districts.every((d) => selected.has(d));
    setSelected((prev) => {
      const next = new Set(prev);
      region.districts.forEach((d) => (allSelected ? next.delete(d) : next.add(d)));
      return next;
    });
  };

  const handleSave = () => {
    route.params.onSave([...selected]);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="სამუშაო არეალი" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <RegionAreaAccordion selected={selected} onToggleDistrict={toggleDistrict} onToggleAllInRegion={toggleAllInRegion} />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          {selected.size > 0 ? `არჩეულია ${selected.size} არეალი` : 'არეალი არ არის შერჩეული'}
        </Text>
        <Button label="შენახვა" onPress={handleSave} disabled={selected.size === 0} />
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
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  footerNote: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
