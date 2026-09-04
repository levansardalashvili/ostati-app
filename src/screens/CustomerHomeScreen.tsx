import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronRight, LayoutGrid, Search, X } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { CategoryIcon, getCategoryIcon } from '../components/CategoryIcon';
import { ProviderCard, ProviderCardSkeleton } from '../components/ProviderCard';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES, SPECIALTY_LABEL } from '../data/categories';
import { TBILISI_AREAS as DISTRICTS } from '../data/districts';
import { authService } from '../services/authService';
import { categoryService } from '../services/categoryService';
import { jobService } from '../services/jobService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { CustomerJob } from '../types/job';
import type { Provider } from '../types/provider';
import { providerRankScore } from '../utils/providerRank';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// "ტოპ ოსტატები" რანჟირება — არა უბრალო ბოლო რეგისტრაცია (მომხმარებლის
// მოთხოვნით), წონიანი/Bayesian ფორმულით (src/utils/providerRank.ts) —
// მანიპულაციისგან დაცული (5.0/1 შეფასება ვერ გადააჭარბებს 4.9/180-ს).

// C1 — Customer Home / Browse (product-spec.md; დიზაინის რეფერენსის
// CustomerHome-ის მიხედვით)
export function CustomerHomeScreen({ navigation }: Props) {
  const { profile } = useCustomerProfile();
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
  const [search, setSearch] = useState('');
  const [selCats, setSelCats] = useState<Set<string>>(new Set());
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
        // #85: ადრე `isLoading` ცალკე, ფიქსირებული 950ms `setTimeout`-ით
        // იმართებოდა, სრულიად დაუკავშირებელი ამ რეალურ fetch-თან —
        // ნელი ქსელისას (950ms-ზე ხანგრძლივი fetch) ეს ნიშნავდა, რომ
        // skeleton ნაადრევად ქრებოდა და "ოსტატები ვერ მოიძებნა" ცარიელი
        // state ერთი წამით ცდომილად გამოკრთებოდა, სანამ `providers`
        // რეალურად ჩაიტვირთებოდა. ახლა `isLoading` პირდაპირ ამ fetch-ის
        // დასრულებაზეა დამოკიდებული.
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Customer-ის საკუთარი რაიონი, დაცული მისამართიდან ამოღებული — DISTRICTS
  // (TBILISI_AREAS)-ის ჩამონათვალის substring-შედარებით, რადგან
  // defaultAddress თავისუფალი ტექსტია ("რაიონი, ქალაქი" ან პირიქით).
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

  // მთხოვნის მიხედვით — არეალის ფილტრის UI (ჩიპები) Home-იდან მოცილებულია
  // მთლიანად, მაგრამ "ტოპ ოსტატები შენს არეალში" კვლავ ავტომატურად
  // ითვლის Customer-ის საკუთარ არეალში (myDistrict) — მომხმარებელს აღარ
  // შეუძლია ამის ხელით შეცვლა/გამორთვა Home-ზე. თუ არეალი ვერ დგინდება
  // (myDistrict === null), ფილტრი უბრალოდ არ გამოიყენება (fallback —
  // ცარიელი/გატეხილი სექციის ნაცვლად საერთო ტოპ სია ჩანს).
  const rankedInArea = useMemo(() => {
    return providers
      .filter((p) => {
        if (selCats.size > 0 && !selCats.has(p.category)) return false;
        if (myDistrict && !p.areas.includes(myDistrict)) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const spec = (SPECIALTY_LABEL[p.category] ?? '').toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !spec.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => providerRankScore(b) - providerRankScore(a));
  }, [providers, search, selCats, myDistrict]);
  // Home-ზე მხოლოდ ტოპ 5 ჩანს — "ყველას ნახვა" ხსნის სრულ სიას
  // (CustomerProviderListScreen), საკუთარი არეალის/სხვა ფილტრებით.
  const topProviders = rankedInArea.slice(0, 5);

  const clearFilters = () => {
    setSelCats(new Set());
    setSearch('');
  };

  const handleNotifications = () => {
    navigation.navigate('Notifications', { role: 'customer' });
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
  const handleAllServices = () => {
    navigation.navigate('CustomerCategories');
  };
  const handleViewAllProviders = () => {
    navigation.navigate('CustomerProviderList');
  };

  // Task 6 (audit) — "ტოპ 3" ახლა ბექენდის `featured` დროშაზეა აგებული
  // (`categoryService`, `categories.featured`), ადრინდელი ჰარდქოდილი
  // `TOP_CATEGORY_IDS`-ის ნაცვლად. bg/dot ფერები კვლავ ლოკალურია.
  const [categoryList, setCategoryList] = useState(() => categoryService.getCached());
  useEffect(() => {
    let cancelled = false;
    categoryService
      .listCategories()
      .then((list) => {
        if (!cancelled) setCategoryList(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const topCategories = [...categoryList]
    .filter((c) => c.featured && c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const style = CATEGORIES.find((sc) => sc.id === c.id);
      return { id: c.id, label: c.name, bg: style?.bg ?? colors.muted, dot: style?.dot ?? colors.mutedForeground };
    });

  // "მიმდინარე სამუშაო" — ჩანს მხოლოდ მაშინ, როცა Customer-მა კონკრეტულ
  // Provider-ს აირჩია (status === 'active'). დაჭერისას იხსნება არსებული
  // CustomerJobDetail ეკრანი — არა ცალკე duplicate დეტალის ეკრანი.
  const [myJobs, setMyJobs] = useState<CustomerJob[]>([]);
  // #83: `useFocusEffect`-ზეა (არა mount-ზე ერთხელ) — Home არასდროს
  // unmount-დება (Bottom Tab), ამიტომ plain `useEffect`-ს ვერასდროს
  // "შეეტყობოდა" job-ის გაუქმებაზე, თუ Customer-მა ის CustomerJobDetail-იდან
  // გააუქმა და უკან Home-ზე დაბრუნდა — "მიმდინარე სამუშაო" ბარათი
  // "active"-ად "გაყინული" დარჩებოდა permanently, მთელი session-ის
  // განმავლობაში, თუნდაც job რეალურად უკვე "cancelled"-ია.
  useFocusEffect(
    useCallback(() => {
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) return;
      let cancelled = false;
      jobService
        .listMyJobPosts(uid)
        .then((real) => {
          if (!cancelled) setMyJobs(real);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );
  const currentJob = myJobs.find((j) => j.status === 'active') ?? null;

  // ბელის წითელი წერტილი (#70) — mock ნაგულისხმებია, სანამ session
  // ცოცხალი Realtime subscription-ით (`notificationService`) რეალურ
  // count-ს არ დაადასტურებს (ან 0-ს) — `chatService.subscribeToUnreadCount`-ის
  // (#68) იგივე პრინციპი.
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    return notificationService.subscribeToUnreadCount(uid, setUnreadNotifCount);
  }, []);
  const currentJobCategory = currentJob ? CATEGORIES.find((c) => c.id === currentJob.category) : null;
  const handleOpenCurrentJob = () => {
    if (!currentJob) return;
    navigation.navigate('CustomerJobDetail', { jobId: currentJob.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Avatar initials={initials} color="#7C3AED" size={38} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>გამარჯობა,</Text>
            <Text style={styles.name} numberOfLines={1}>
              {profile.firstName} {profile.lastName.charAt(0)}. 👋
            </Text>
          </View>
          <Pressable style={styles.bellButton} onPress={handleNotifications}>
            <Bell size={19} color={colors.foreground} strokeWidth={1.8} />
            {unreadNotifCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

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
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {currentJob && currentJobCategory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>მიმდინარე სამუშაო</Text>
            <Pressable style={styles.currentJobCard} onPress={handleOpenCurrentJob}>
              <CategoryIcon categoryId={currentJobCategory.id} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.currentJobCategory}>{currentJobCategory.label}</Text>
                <Text style={styles.currentJobProvider} numberOfLines={1}>
                  {currentJob.provider}
                </Text>
                <Text style={styles.currentJobDate}>{currentJob.date}</Text>
              </View>
              <View style={styles.currentJobRight}>
                <StatusPill status={currentJob.status} />
                <ChevronRight size={16} color={colors.mutedForeground} />
              </View>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>სერვისები</Text>
            {selCats.size > 0 && (
              <Pressable onPress={() => setSelCats(new Set())}>
                <Text style={styles.clearLink}>გასუფთ.</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.serviceGrid}>
            {topCategories.map((c) => {
              const selected = selCats.has(c.id);
              const ServiceIcon = getCategoryIcon(c.id);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.serviceCard, selected && styles.serviceCardSelected]}
                  onPress={() => toggleCat(c.id)}
                >
                  <View style={[styles.serviceIconWrap, { backgroundColor: c.bg }]}>
                    <ServiceIcon size={20} color={c.dot} strokeWidth={2} />
                  </View>
                  <Text style={styles.serviceLabel} numberOfLines={2}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.serviceCard} onPress={handleAllServices}>
              <View style={[styles.serviceIconWrap, { backgroundColor: colors.secondary }]}>
                <LayoutGrid size={20} color={colors.secondaryForeground} />
              </View>
              <Text style={styles.serviceLabel} numberOfLines={2}>
                ყველა სერვისი
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.resultsTitle}>ტოპ ოსტატები შენს არეალში</Text>
            {!isLoading && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{rankedInArea.length}</Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((i) => (
                <ProviderCardSkeleton key={i} />
              ))}
            </View>
          ) : topProviders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Search size={24} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>ოსტატები ვერ მოიძებნა</Text>
              <Text style={styles.emptySubtitle}>სცადე სხვა კატეგორიის არჩევა.</Text>
              <Pressable style={styles.emptyButton} onPress={clearFilters}>
                <Text style={styles.emptyButtonText}>ფილტრების შეცვლა</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ gap: spacing.md }}>
                {topProviders.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    onOpenProfile={() => handleOpenProvider(p.id)}
                    onMessage={() => handleOpenChat(p)}
                  />
                ))}
              </View>
              <Pressable style={styles.viewAllButton} onPress={handleViewAllProviders}>
                <Text style={styles.viewAllButtonText}>ყველას ნახვა</Text>
                <ChevronRight size={16} color={colors.primary} />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  name: {
    ...typography.h2,
    color: colors.foreground,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
    borderWidth: 1,
    borderColor: colors.card,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  clearLink: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  currentJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  currentJobCategory: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  currentJobProvider: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginTop: 1,
  },
  currentJobDate: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  currentJobRight: {
    alignItems: 'flex-end',
    gap: spacing.xs + 2,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serviceCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  serviceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  serviceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
    lineHeight: 15,
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  viewAllButtonText: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
});
