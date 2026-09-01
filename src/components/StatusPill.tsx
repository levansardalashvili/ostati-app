import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { JobStatus } from '../types/job';

// JobStatus გადატანილია src/types/job.ts-ში (state machine-ის სრული
// დოკუმენტაციითურთ) — აქ რეექსპორტდება, რომ არსებული
// `import { StatusPill, type JobStatus } from '../components/StatusPill'`
// import-ები ყველგან ხელუხლებელი დარჩეს.
export type { JobStatus };

// ძირითადი user-facing lifecycle ტექსტი (მომხმარებლის მოთხოვნით): "მომლოდინე"
// → "დადასტურებულია" → "დასრულებულია". შიდა ტიპის key-ები (`active` და ა.შ.)
// უცვლელია — მხოლოდ ნაჩვენები ტექსტი შეიცვალა.
const STATUS_MAP: Record<JobStatus, { label: string; bg: string; text: string; dot: string }> = {
  // არასდროს არ უნდა გამოჩნდეს UI-ში ნორმალურ ნაკადში (listMyJobPosts
  // გამორიცხავს, #53) — მხოლოდ ტიპის სისრულისთვის (Record<JobStatus, ...>).
  draft: { label: 'დაუსრულებელი', bg: colors.muted, text: colors.mutedForeground, dot: colors.mutedForeground },
  active: { label: 'დადასტურებულია', bg: colors.successBackground, text: colors.success, dot: colors.success },
  pending: { label: 'მომლოდინე', bg: colors.warningBackground, text: colors.warning, dot: colors.warning },
  awaiting_customer_confirmation: {
    label: 'ელოდება დადასტურებას',
    bg: colors.warningBackground,
    text: colors.warning,
    dot: colors.warning,
  },
  confirmed_awaiting_rating: {
    label: 'ელოდება შეფასებას',
    bg: colors.warningBackground,
    text: colors.warning,
    dot: colors.warning,
  },
  disputed: { label: 'პრობლემაა', bg: colors.dangerBackground, text: colors.destructive, dot: colors.destructive },
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
