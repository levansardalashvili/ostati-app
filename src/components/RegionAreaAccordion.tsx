import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import { GEORGIA_REGIONS } from '../data/georgiaRegions';

type Props = {
  selected: Set<string>;
  onToggleDistrict: (district: string) => void;
  onToggleAllInRegion: (regionId: string) => void;
  defaultExpanded?: string[];
};

// RegionAreaAccordion — საქართველოს მხარეების/რაიონების არჩევის ბადე,
// გამოიყენება როგორც ProviderSetup-ის რეგისტრაციის picker-ში (RegionAreaPicker
// ეკრანი), ისე პროფილის "დაფარვის რაიონები" ეკრანზე პირდაპირ ჩაშენებული.
export function RegionAreaAccordion({ selected, onToggleDistrict, onToggleAllInRegion, defaultExpanded = ['tbilisi'] }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpanded));

  const toggleExpanded = (regionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(regionId) ? next.delete(regionId) : next.add(regionId);
      return next;
    });
  };

  return (
    <View style={{ gap: spacing.sm + 2 }}>
      {GEORGIA_REGIONS.map((region) => {
        const isExpanded = expanded.has(region.id);
        const selectedCount = region.districts.filter((d) => selected.has(d)).length;
        const allSelected = selectedCount === region.districts.length;

        return (
          <View key={region.id} style={styles.regionCard}>
            <Pressable style={styles.regionHeader} onPress={() => toggleExpanded(region.id)}>
              <Text style={styles.regionLabel}>{region.label}</Text>
              <View style={styles.regionHeaderRight}>
                {selectedCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{selectedCount}</Text>
                  </View>
                )}
                <View style={isExpanded ? styles.chevronOpen : undefined}>
                  <ChevronDown size={18} color={colors.mutedForeground} />
                </View>
              </View>
            </Pressable>

            {isExpanded && (
              <View style={styles.districtList}>
                <Pressable style={styles.districtRow} onPress={() => onToggleAllInRegion(region.id)}>
                  <View style={[styles.checkbox, allSelected && styles.checkboxOn]}>
                    {allSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.selectAllText}>ყველას მონიშვნა</Text>
                </Pressable>
                {region.districts.map((district) => {
                  const on = selected.has(district);
                  return (
                    <Pressable key={district} style={styles.districtRow} onPress={() => onToggleDistrict(district)}>
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <Text style={styles.districtText}>{district}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  regionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  regionLabel: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    flex: 1,
  },
  regionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondaryForeground,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  districtList: {
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingVertical: spacing.xs,
  },
  districtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
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
  selectAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  districtText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
});
