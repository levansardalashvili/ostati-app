import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { getCategoryIcon } from '../components/CategoryIcon';
import { Chip } from '../components/Chip';
import { ProviderCard, ProviderCardSkeleton } from '../components/ProviderCard';
import { StartJobChatSheet } from '../components/StartJobChatSheet';
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
  // Task — კატეგორიების ჩამონათვალი (chip-row, მრავალარჩევანი) ჩანაცვლდა
  // ერთარჩევანიანი dropdown-ით (მომხმარებლის მოთხოვნით) — იგივე
  // "ველი-ღილაკი + BottomSheet სია" პატერნი, რასაც PostJobScreen-ის
  // საკუთარი კატეგორიის dropdown იყენებს (#23/#39).
  const [selCategory, setSelCategory] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  // Task — ძველი, გრძელი თბილისის რაიონების chip-სია (`TBILISI_AREAS`)
  // ჩანაცვლდა თავისუფალი ტექსტის ძებნით — Provider-ის `areas` მთელი
  // საქართველოს მოიცავს (georgiaRegions.ts, #9), chip-სია კი ამის მხოლოდ
  // მცირე ნაწილს (თბილისი) აჩვენებდა — "გორი"-ს ტიპის საქალაქო/რეგიონული
  // არეალი საერთოდ ვერასდროს მოიძებნებოდა. "ყველა არეალი"/"ჩემი არეალი"
  // chip-ები დარჩა (მომხმარებლის დაზუსტებით) — ორივე ახლა უბრალოდ ამ
  // ერთი `areaSearch`-ის მოსახერხებელი პრესეტია (არა ცალკე, დამოუკიდებელი
  // filter-მდგომარეობა): "ყველა არეალი" ასუფთავებს ძებნის ველს, "ჩემი
  // არეალი" კი ავსებს მას მომხმარებლის საკუთარი, ამოხსნილი რაიონით.
  const [areaSearch, setAreaSearch] = useState('');
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

  const filtered = useMemo(() => {
    const areaQuery = areaSearch.trim().toLowerCase();
    return providers
      .filter((p) => {
        if (selCategory && p.category !== selCategory) return false;
        if (areaQuery && !p.areas.some((a) => a.toLowerCase().includes(areaQuery))) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const spec = (SPECIALTY_LABEL[p.category] ?? '').toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !spec.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => providerRankScore(b) - providerRankScore(a));
  }, [providers, search, selCategory, areaSearch]);

  const clearFilters = () => {
    setSelCategory(null);
    setAreaSearch('');
    setSearch('');
  };

  const selectedCategoryLabel = CATEGORIES.find((c) => c.id === selCategory)?.label ?? null;
  const SelectedCategoryIcon = getCategoryIcon(selCategory ?? '');

  const handleOpenProvider = (id: string) => {
    navigation.navigate('ViewProviderProfile', { id });
  };
  // "ცივი ჩატის → job-ის შექმნის" ხვრელის ფიქსი — StartJobChatSheet.tsx-ის
  // თავზე სრული მიზეზი (ViewProviderProfileScreen-ის იგივე ცვლილება).
  const [startChatProvider, setStartChatProvider] = useState<Provider | null>(null);
  const handleOpenChat = (provider: Provider) => setStartChatProvider(provider);
  const openChatWithJob = (jobId: string | null, draftMessage?: string) => {
    if (!startChatProvider) return;
    const provider = startChatProvider;
    setStartChatProvider(null);
    navigation.navigate('ChatConversation', {
      chatId: provider.id,
      name: provider.name,
      initials: provider.initials,
      color: provider.color,
      role: 'customer',
      jobId: jobId ?? undefined,
      draftMessage,
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
        <View style={styles.categoryFieldWrap}>
          <Pressable style={styles.categoryField} onPress={() => setCategorySheetOpen(true)}>
            <SelectedCategoryIcon size={17} color={selCategory ? colors.primary : colors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.categoryFieldText, !selCategory && styles.categoryFieldPlaceholder]} numberOfLines={1}>
              {selectedCategoryLabel ?? 'აირჩიე სერვისი'}
            </Text>
            <ChevronDown size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip variant="filled" label="ყველა არეალი" selected={!areaSearch.trim()} onPress={() => setAreaSearch('')} />
          {myDistrict && (
            <Chip
              variant="filled"
              label="ჩემი არეალი"
              selected={areaSearch.trim().toLowerCase() === myDistrict.toLowerCase()}
              onPress={() =>
                setAreaSearch(areaSearch.trim().toLowerCase() === myDistrict.toLowerCase() ? '' : myDistrict)
              }
            />
          )}
        </ScrollView>
        <View style={styles.areaSearchWrap}>
          <View style={styles.searchBar}>
            <MapPin size={16} color={colors.mutedForeground} />
            <TextInput
              value={areaSearch}
              onChangeText={setAreaSearch}
              placeholder="მოძებნეთ სასურველი არეალი"
              placeholderTextColor={colors.mutedForeground}
              style={styles.searchInput}
            />
            {areaSearch.length > 0 && (
              <Pressable onPress={() => setAreaSearch('')}>
                <X size={15} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>
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

      <BottomSheet visible={categorySheetOpen} onClose={() => setCategorySheetOpen(false)}>
        <Text style={styles.sheetTitle}>სერვისი</Text>
        <ScrollView style={styles.categorySheetList} showsVerticalScrollIndicator={false}>
          <Pressable
            style={styles.categorySheetRow}
            onPress={() => {
              setSelCategory(null);
              setCategorySheetOpen(false);
            }}
          >
            <Text style={[styles.categoryLabel, !selCategory && styles.categoryLabelSelected]}>ყველა სერვისი</Text>
            {!selCategory && <Check size={16} color={colors.primary} strokeWidth={3} />}
          </Pressable>
          {CATEGORIES.map((c) => {
            const on = selCategory === c.id;
            const Icon = getCategoryIcon(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setSelCategory(c.id);
                  setCategorySheetOpen(false);
                }}
                style={styles.categorySheetRow}
              >
                <View style={styles.categoryIconWrap}>
                  <Icon size={18} color={on ? colors.primary : colors.mutedForeground} strokeWidth={2} />
                </View>
                <Text style={[styles.categoryLabel, on && styles.categoryLabelSelected]}>{c.label}</Text>
                {on && <Check size={16} color={colors.primary} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
      <StartJobChatSheet
        provider={startChatProvider}
        onClose={() => setStartChatProvider(null)}
        onReady={openChatWithJob}
      />
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
  areaSearchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  categoryFieldWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  categoryField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  categoryFieldText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
    flex: 1,
  },
  categoryFieldPlaceholder: {
    color: colors.mutedForeground,
    fontWeight: '400',
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.sm + 2,
  },
  categorySheetList: {
    maxHeight: 420,
  },
  categorySheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  categoryIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
    flex: 1,
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
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
