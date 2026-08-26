import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, FileText, MapPin, MessageCircle, Plus, Search, Star, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { Chip } from '../components/Chip';
import { Skeleton } from '../components/Skeleton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES, SPECIALTY_LABEL } from '../data/categories';
import { TBILISI_AREAS as DISTRICTS } from '../data/districts';
import { PROVIDERS, Provider } from '../data/mockHomeData';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

// TODO: notifications backend არ არსებობს ჯერ — placeholder რიცხვი
const MOCK_UNREAD_COUNT = 2;

const SPEC_CATS = [
  { id: 'plumbing', label: 'სანტექნიკოსი', icon: '🔧' },
  { id: 'electrical', label: 'ელექტრიკოსი', icon: '⚡' },
  { id: 'painting', label: 'მღებავი', icon: '🖌️' },
  { id: 'furniture', label: 'ავეჯის სპეც.', icon: '🪑' },
  { id: 'ac', label: 'კონდ. სპეც.', icon: '❄️' },
];

// C1 — Customer Home / Browse (product-spec.md; დიზაინის რეფერენსის
// CustomerHome-ის მიხედვით)
export function CustomerHomeScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [selCats, setSelCats] = useState<Set<string>>(new Set());
  const [selDistrict, setSelDistrict] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 950);
    return () => clearTimeout(t);
  }, []);

  const toggleCat = (id: string) =>
    setSelCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    return PROVIDERS.filter((p) => {
      if (selCats.size > 0 && !selCats.has(p.category)) return false;
      if (selDistrict && !p.location.includes(selDistrict)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const spec = (SPECIALTY_LABEL[p.category] ?? '').toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !spec.includes(q)) return false;
      }
      return true;
    });
  }, [search, selCats, selDistrict]);

  const clearFilters = () => {
    setSelCats(new Set());
    setSelDistrict(null);
    setSearch('');
  };

  const handleNotifications = () => {
    // TODO: Notifications ეკრანი ჯერ არ არსებობს
  };
  const handleOpenProvider = (_id: string) => {
    // TODO: Provider Profile ეკრანი ჯერ არ არსებობს
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
  const handlePostJob = () => {
    navigation.navigate('PostJob');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Avatar initials="ნს" color="#7C3AED" size={38} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>გამარჯობა,</Text>
            <Text style={styles.name}>ნინო სულაბ. 👋</Text>
          </View>
          <Pressable style={styles.bellButton} onPress={handleNotifications}>
            <Bell size={19} color={colors.foreground} strokeWidth={1.8} />
            {MOCK_UNREAD_COUNT > 0 && <View style={styles.bellDot} />}
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
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>სერვისები</Text>
            {selCats.size > 0 && (
              <Pressable onPress={() => setSelCats(new Set())}>
                <Text style={styles.clearLink}>გასუფთ.</Text>
              </Pressable>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip variant="filled" label="ყველა" selected={selCats.size === 0} onPress={() => setSelCats(new Set())} />
            {SPEC_CATS.map((c) => (
              <Chip
                key={c.id}
                variant="filled"
                label={`${c.icon} ${c.label}`}
                selected={selCats.has(c.id)}
                onPress={() => toggleCat(c.id)}
              />
            ))}
          </ScrollView>

          {selCats.size > 0 && (
            <View style={styles.selectedPills}>
              {[...selCats].map((id) => {
                const c = SPEC_CATS.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <View key={id} style={styles.pill}>
                    <Text style={styles.pillText}>
                      {c.icon} {c.label}
                    </Text>
                    <Pressable onPress={() => toggleCat(id)}>
                      <X size={10} color={colors.secondaryForeground} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>რაიონი</Text>
            {selDistrict && (
              <Pressable onPress={() => setSelDistrict(null)}>
                <Text style={styles.clearLink}>გასუფთ.</Text>
              </Pressable>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip variant="filled" label="ყველა" selected={!selDistrict} onPress={() => setSelDistrict(null)} />
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

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.resultsTitle}>ხელმისაწვდომი ოსტატები</Text>
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
              <Text style={styles.emptySubtitle}>სცადე სხვა კატეგორიის ან რაიონის არჩევა.</Text>
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
        </View>

        <View style={styles.ctaSection}>
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            style={styles.ctaCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.ctaRow}>
              <View style={styles.ctaIcon}>
                <FileText size={18} color="#FFFFFF" />
              </View>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaTitle}>ვერ იპოვე სასურველი ოსტატი?</Text>
                <Text style={styles.ctaSubtitle}>
                  გამოაქვეყნე მოთხოვნა და დაინტ. ოსტატები თავად გამოგეხმ.
                </Text>
              </View>
            </View>
            <Pressable style={styles.ctaButton} onPress={handlePostJob}>
              <Plus size={18} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.ctaButtonText}>მოთხოვნის გამოქვეყნება</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderCard({
  provider,
  onOpenProfile,
  onMessage,
}: {
  provider: Provider;
  onOpenProfile: () => void;
  onMessage: () => void;
}) {
  const specialty = SPECIALTY_LABEL[provider.category] ?? CATEGORIES.find((c) => c.id === provider.category)?.label ?? '';
  const district = provider.location.replace(', თბილისი', '');

  return (
    <View style={styles.providerCard}>
      <Pressable style={styles.providerCardBody} onPress={onOpenProfile}>
        <Avatar initials={provider.initials} color={provider.color} size={54} online={provider.online} />
        <View style={styles.providerInfo}>
          <View style={styles.providerNameRow}>
            <Text style={styles.providerName} numberOfLines={1}>
              {provider.name}
            </Text>
            {provider.verified && <VerifiedBadge size={15} />}
          </View>
          <Text style={styles.providerMeta}>
            {specialty} • {provider.years} წ. გამოცდ.
          </Text>
          <View style={styles.providerStatsRow}>
            <View style={styles.ratingRow}>
              <Star size={12} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.ratingText}>{provider.rating}</Text>
              <Text style={styles.reviewsText}>({provider.reviews} შეფ.)</Text>
            </View>
            <Text style={styles.dotSeparator}>•</Text>
            <View style={styles.locationRow}>
              <MapPin size={11} color={colors.mutedForeground} />
              <Text style={styles.locationText}>{district}</Text>
            </View>
          </View>
          <View style={styles.availabilityRow}>
            {provider.online ? (
              <View style={styles.availableRow}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>ხელმისაწვდომი</Text>
              </View>
            ) : (
              <Text style={styles.busyText}>დაკავებული</Text>
            )}
          </View>
        </View>
      </Pressable>

      <View style={styles.providerActionRow}>
        <Text style={styles.priceText} numberOfLines={1}>
          {provider.price}
        </Text>
        <Pressable style={styles.messageButton} onPress={onMessage}>
          <MessageCircle size={14} color={colors.primaryForeground} />
          <Text style={styles.messageButtonText}>მიწერა</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProviderCardSkeleton() {
  return (
    <View style={styles.providerCard}>
      <View style={[styles.providerCardBody, { paddingBottom: spacing.md }]}>
        <Skeleton width={54} height={54} borderRadius={radius.full} />
        <View style={[styles.providerInfo, { gap: spacing.xs }]}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="50%" height={12} />
          <Skeleton width="60%" height={12} />
        </View>
      </View>
    </View>
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
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  selectedPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  pillText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '600',
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
  providerCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  providerCardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
  providerInfo: {
    flex: 1,
    minWidth: 0,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  providerName: {
    ...typography.bodyMedium,
    color: colors.foreground,
    flexShrink: 1,
  },
  providerMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  providerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  reviewsText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  dotSeparator: {
    color: colors.border,
    fontSize: 9,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  availabilityRow: {
    marginTop: spacing.xs,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  availableText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
  },
  busyText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  providerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  priceText: {
    ...typography.small,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  messageButtonText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  ctaSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  ctaCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextWrap: {
    flex: 1,
  },
  ctaTitle: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  ctaSubtitle: {
    ...typography.small,
    color: '#BFDBFE',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
  },
  ctaButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
});
