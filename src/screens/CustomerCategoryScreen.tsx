import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, MapPin, Search, Star } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTY_LABEL } from '../data/categories';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import type { Provider } from '../types/provider';
import { isNewProvider } from '../utils/providerRank';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerCategory'>;

// CustomerCategory — ერთი კონკრეტული სერვისის კატეგორიის ოსტატების სია
// (ზიპის App.tsx-ის CustomerCategory-ის მიხედვით, გასწორებული ბაგით —
// ზიპში ეს ეკრანი ყველა ოსტატს უფილტრაციოდ აჩვენებდა).
export function CustomerCategoryScreen({ navigation, route }: Props) {
  // Task 6 (audit) — სახელი ბექენდიდანაა (`categoryService`, cache-ით/
  // fallback-ით), ლოკალური `CATEGORIES.find`-ის ნაცვლად.
  const [categoryName, setCategoryName] = useState(() => categoryService.getCached().find((c) => c.id === route.params.id)?.name);
  useEffect(() => {
    let cancelled = false;
    categoryService
      .listCategories()
      .then((list) => {
        if (!cancelled) setCategoryName(list.find((c) => c.id === route.params.id)?.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [route.params.id]);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  useEffect(() => {
    let cancelled = false;
    userService
      .listRealProviders()
      .then((real) => {
        if (!cancelled) setAllProviders(real);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const providers = useMemo(
    () => allProviders.filter((p) => p.category === route.params.id),
    [allProviders, route.params.id],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title={categoryName ?? 'ყველა ოსტატი'} onBack={() => navigation.goBack()} />
      {providers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Search size={24} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>ამ სერვისში ოსტატები ჯერ არ არის</Text>
          <Text style={styles.emptySubtitle}>მალე გამოჩნდებიან — სცადე მოგვიანებით.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {providers.map((p) => {
            const specialty = SPECIALTY_LABEL[p.category] ?? p.category;
            const district = p.location.replace(', თბილისი', '');
            return (
              <Pressable
                key={p.id}
                style={styles.card}
                onPress={() => navigation.navigate('ViewProviderProfile', { id: p.id })}
              >
                <View style={styles.cardTop}>
                  <Avatar initials={p.initials} color={p.color} size={52} online={p.online} uri={p.photoUrl} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {p.verified && <VerifiedBadge size={14} />}
                    </View>
                    <Text style={styles.specialty}>{specialty}</Text>
                  </View>
                  <Text style={styles.price} numberOfLines={1}>
                    {p.price}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  {isNewProvider(p) ? (
                    <Text style={styles.newProviderText}>ახალი ოსტატი</Text>
                  ) : (
                    <View style={styles.statItem}>
                      <Star size={12} color="#FBBF24" fill="#FBBF24" />
                      <Text style={styles.statValue}>{p.rating}</Text>
                      <Text style={styles.statMuted}>({p.reviews} შეფ.)</Text>
                    </View>
                  )}
                  <Text style={styles.dot}>·</Text>
                  <View style={styles.statItem}>
                    <Briefcase size={11} color={colors.mutedForeground} />
                    <Text style={styles.statMuted}>{p.jobs} სამ.</Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <MapPin size={12} color={colors.mutedForeground} />
                  <Text style={styles.statMuted}>{district}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
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
    gap: spacing.sm + 4,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.foreground,
    flexShrink: 1,
  },
  specialty: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  price: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  statMuted: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  newProviderText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '700',
  },
  dot: {
    color: colors.border,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
