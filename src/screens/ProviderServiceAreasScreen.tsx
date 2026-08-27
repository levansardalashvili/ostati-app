import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme';
import { TBILISI_AREAS } from '../data/districts';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderServiceAreas'>;

// ProviderServiceAreas — ზუსტად ზიპის App.tsx-ის ProviderServiceAreas-ის
// მიხედვით.
export function ProviderServiceAreasScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(['ვაკე', 'საბურთალო', 'ვერა']));
  const [saved, setSaved] = useState(false);

  const toggle = (area: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(area) ? next.delete(area) : next.add(area);
      return next;
    });
  };

  const handleSave = () => {
    if (selected.size === 0 || saved) return;
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      navigation.goBack();
    }, 700);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="დაფარვის რაიონები" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.intro}>აირჩიე რაიონები, სადაც სამუშაოს შესრულება შეგიძლია.</Text>
        <View style={styles.grid}>
          {TBILISI_AREAS.map((area) => {
            const on = selected.has(area);
            return (
              <Pressable key={area} style={[styles.areaChip, on && styles.areaChipOn]} onPress={() => toggle(area)}>
                <Text style={[styles.areaText, on && styles.areaTextOn]}>{area}</Text>
                {on && <Check size={15} color={colors.primary} strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.countNote}>
          {selected.size > 0 ? `${selected.size} რაიონი შერჩეულია` : 'რაიონი არ არის შერჩეული'}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={saved ? 'შენახულია!' : 'შენახვა'} onPress={handleSave} disabled={selected.size === 0 || saved} />
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
  intro: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  areaChipOn: {
    backgroundColor: colors.secondary,
    borderColor: '#93C5FD',
  },
  areaText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  areaTextOn: {
    color: colors.secondaryForeground,
  },
  countNote: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.md,
    paddingHorizontal: 2,
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
});
