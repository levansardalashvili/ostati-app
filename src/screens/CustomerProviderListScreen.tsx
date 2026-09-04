import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Chip } from '../components/Chip';
import { ProviderCard, ProviderCardSkeleton } from '../components/ProviderCard';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES, SPECIALTY_LABEL } from '../data/categories';
import { TBILISI_AREAS as DISTRICTS } from '../data/districts';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { Provider } from '../types/provider';
import { providerRankScore } from '../utils/providerRank';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerProviderList'>;

// CustomerProviderList — CustomerHomeScreen-ის "ტოპ ოსტატები შენს
// არეალში" სექციის "ყველას ნახვა"-ს სრული ვერსია (ProviderJobFeedScreen-ის
// იგივე "Home-ზე 5 + სრული სია ცალკე ეკრანზე" პრინციპი, #29). Provider-ის
// fetching (`userService.listRealProviders`) და რანჟირება
// (`providerRankScore`) იმავე გაზიარებულ სერვისს/util-ს იძახებს, რასაც
// Home — არაფერი არ არის დუბლირებული, უბრალოდ იმავე ფუნქციების ხელახალი
// გამოძახება, ისევე როგორც Job Feed-ის Home/Full-სია წყვილს შორის.
// არეალის ფილტრი (Home-იდან მოცილებული) აქ ცოცხლდება, კატეგორია/ძებნასთან
// ერთად.
export function CustomerProviderListScreen({ navigation }: Props) {
  const { profile } = useCustomerProfile();
  const [search, setSearch] = useState('');
  const [selCats, setSelCats] = useState<Set<string>>(new Set());
  const [selDistrict, setSelDistrict] = useState<string | 'mine' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    userService
      .listRealProviders()
      .then((real) => {
        if (!cancelled) setProviders(real);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const myDistrict = useMemo(
    () => DISTRICTS.find((d) => profile.defaultAddress.includes(d)) ?? null,
    [profile.defaultAddress],
  );

  const toggleCat = (id: string) =>
    setSelCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const effectiveDistrict = selDistrict === 'mine' ? myDistrict : selDistrict;
    return providers
      .filter((p) => {
        if (selCats.size > 0 && !selCats.has(p.category)) return false;
        if (effectiveDistrict && !p.areas.includes(effectiveDistrict)) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const spec = (SPECIALTY_LABEL[p.category] ?? '').toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !spec.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => providerRankScore(b) - providerRankScore(a));
  }, [providers, search, selCats, selDistrict, myDistrict]);

  const clearFilters = () => {
    setSelCats(new Set());
    setSelDistrict(null);
    setSearch('');
  };

  const handleOpenProvider = (id: string) => {
    navigation.navigate('ViewProviderProfile', { id });
  };
  const handleOpenChat = (provider: Provider) => {
    navigation.navigate('ChatConversation', {
      chatId: provider.id,
      name: provider.name,
      initials: provider.initials,
      color: provider.color,
      role: 'customer',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ყველა ოსტატი" onBack={() => navigation.goBack()} />

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="მოძებნე ოსტატი..."
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} variant="filled" label={c.label} selected={selCats.has(c.id)} onPress={() => toggleCat(c.id)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip variant="filled" label="ყველა არეალი" selected={!selDistrict} onPress={() => setSelDistrict(null)} />
          {myDistrict && (
            <Chip
              variant="filled"
              label="ჩემი არეალი"
              selected={selDistrict === 'mine'}
              onPress={() => setSelDistrict(selDistrict === 'mine' ? null : 'mine')}
            />
          )}
          {DISTRICTS.map((d) => (
            <Chip
              key={d}
              variant="filled"
              label={d}
              selected={selDistrict === d}
              onPress={() => setSelDistrict(d === selDistrict ? null : d)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>ოსტატები</Text>
          {!isLoading && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filtered.length}</Text>
            </View>
          )}
        </View>

        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <ProviderCardSkeleton key={i} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Search size={24} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>ოსტატები ვერ მოიძებნა</Text>
            <Text style={styles.emptySubtitle}>სცადე სხვა კატეგორიის ან არეალის არჩევა.</Text>
            <Pressable style={styles.emptyButton} onPress={clearFilters}>
              <Text style={styles.emptyButtonText}>ფილტრების შეცვლა</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {filtered.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onOpenProfile={() => handleOpenProvider(p.id)}
                onMessage={() => handleOpenChat(p)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  searchInput: {
    flex: 1,
    ...typography.caption,
    color: colors.foreground,
    padding: 0,
  },
  filtersSection: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  resultsTitle: {
    ...typography.h3,
    color: colors.foreground,
  },
  countBadge: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  countBadgeText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
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
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  emptyButtonText: {
    ...typography.captionMedium,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
});
