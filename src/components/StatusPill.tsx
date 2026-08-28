import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export type JobStatus = 'active' | 'pending' | 'completed' | 'cancelled';

// ძირითადი user-facing lifecycle (მომხმარებლის მოთხოვნით): "მომლოდინე"
// (pending — Provider ჯერ არ არის არჩეული) → "დადასტურებულია" (active —
// Customer-მა Provider აირჩია) → "დასრულებულია" (completed — Customer-მა
// დაადასტურა დასრულება და შეაფასა). შიდა ტიპის key-ები (`active` და ა.შ.)
// უცვლელია — მხოლოდ ნაჩვენები ტექსტი შეიცვალა. "გაუქმდა" ამ 3-საფეხურიან
// lifecycle-ის ნაწილი არ არის (გამონაკლისი/terminal state), უცვლელია.
const STATUS_MAP: Record<JobStatus, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'დადასტურებულია', bg: colors.successBackground, text: colors.success, dot: colors.success },
  pending: { label: 'მომლოდინე', bg: colors.warningBackground, text: colors.warning, dot: colors.warning },
  completed: { label: 'დასრულებულია', bg: colors.secondary, text: colors.secondaryForeground, dot: colors.primary },
  cancelled: { label: 'გაუქმდა', bg: colors.dangerBackground, text: colors.destructive, dot: colors.destructive },
};

// Job-ის სტატუსის ბეჯი (დიზაინის რეფერენსის StatusPill-ის მიხედვით)
export function StatusPill({ status }: { status: JobStatus }) {
  const s = STATUS_MAP[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <View style={[styles.dot, { backgroundColor: s.dot }]} />
      <Text style={[styles.label, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
