import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Briefcase, ChevronRight, Clock, MapPin, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProviderFeedJobCard, ProviderFeedJobCardSkeleton } from '../components/ProviderFeedJobCard';
import { StatusPill } from '../components/StatusPill';
import { Switch } from '../components/Switch';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { FeedJob, PROVIDER_FEED } from '../data/mockHomeData';
import { getUnreadCount } from '../data/mockNotifications';
import { CURRENT_PROVIDER_ID, getOpenProviderFeed } from '../data/providerFeedFilters';
import type { ProviderTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ProviderTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MOCK_UNREAD_COUNT = getUnreadCount('provider');
// TODO: რეალური სტატისტიკა Firestore-დან — ჯერჯერობით mock
const MOCK_STATS = [
  { value: '14', label: 'სამ.' },
  { value: '2,840₾', label: 'შემოს.' },
  { value: '4.9★', label: 'შეფ.' },
];

// Home-ზე მხოლოდ ბოლო 5 შესაბამისი მოთხოვნაა ჩანს — დანარჩენის სანახავად
// "ყველას ნახვა" ხსნის სრულ Feed-ს (ProviderJobFeedScreen).
const HOME_FEED_LIMIT = 5;

// B1 — Provider Home (product-spec.md; დიზაინის რეფერენსის ProviderHome-ის
// მიხედვით)
export function ProviderHomeScreen({ navigation }: Props) {
  // `available` მხოლოდ push-შეტყობინებებზე მოქმედებს — Job Feed (`filtered`)
  // მისგან დამოუკიდებელია და OFF-ის დროსაც ჩანს (მომხმარებლის მოთხოვნით).
  const [available, setAvailable] = useState(true);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  // "მიმდინარე სამუშაო" — job, რომელზეც Customer-მა სწორედ ეს Provider აირჩია.
  // ასეთი job Feed-ში აღარ ჩანს (იხ. getOpenProviderFeed).
  const currentJob = PROVIDER_FEED.find((j) => j.assignedProviderId === CURRENT_PROVIDER_ID) ?? null;
  const currentJobCategory = currentJob ? CATEGORIES.find((c) => c.id === currentJob.category) : null;

  const filtered = useMemo(() => getOpenProviderFeed(), []);
  const homeFeed = filtered.slice(0, HOME_FEED_LIMIT);

  const handleNotifications = () => {
    navigation.navigate('Notifications', { role: 'provider' });
  };
  const handleJobDetail = (id: string) => {
    navigation.navigate('ProviderJobDetail', { id });
  };
  const handleOpenCurrentJob = () => {
    if (!currentJob) return;
    navigation.navigate('ProviderJobDetail', { id: currentJob.id, mode: 'selected' });
  };
  const handleViewAllFeed = () => {
    navigation.navigate('ProviderJobFeed');
  };
  const handleOpenChat = (job: FeedJob) => {
    navigation.navigate('ChatConversation', {
      chatId: 'c1',
      name: job.customer,
      initials: job.customer[0],
      color: '#64748B',
      role: 'provider',
    });
  };
  const markInterested = (id: string) => {
    setInterests((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              გამარჯობა, გიორგი
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Avatar initials="გბ" color={colors.primary} size={38} />
            <Pressable style={styles.bellButton} onPress={handleNotifications}>
              <Bell size={19} color={colors.foreground} strokeWidth={1.8} />
              {MOCK_UNREAD_COUNT > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.topCards}>
          <View style={[styles.availabilityCard, available ? styles.availabilityCardOn : styles.availabilityCardOff]}>
            <View style={styles.availabilityLeft}>
              <View style={[styles.availabilityIcon, available ? styles.availabilityIconOn : styles.availabilityIconOff]}>
                <View style={[styles.availabilityDot, { backgroundColor: available ? colors.success : colors.mutedForeground }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.availabilityTitle, { color: available ? '#065F46' : colors.mutedForeground }]}>
                  {available ? 'ხელმისაწვდომი' : 'დაკავებული'}
                </Text>
                <Text style={[styles.availabilitySubtitle, { color: available ? colors.success : colors.mutedForeground }]}>
                  {available ? 'შეტყობინებები ჩართულია' : 'შეტყობინებები გამორთულია'}
                </Text>
              </View>
            </View>
            <Switch value={available} onValueChange={setAvailable} />
          </View>

          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            style={styles.statsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.statsLabel}>ამ თვის სტატისტიკა</Text>
            <View style={styles.statsRow}>
              {MOCK_STATS.map((s) =>
                s.label === 'სამ.' ? (
                  <Pressable key={s.label} style={styles.statBox} onPress={() => navigation.navigate('MyJobsTab')}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </Pressable>
                ) : (
                  <View key={s.label} style={styles.statBox}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ),
              )}
            </View>
          </LinearGradient>
        </View>

        {currentJob && currentJobCategory && (
          <View style={styles.currentJobSection}>
            <Text style={styles.currentJobSectionTitle}>მიმდინარე სამუშაო</Text>
            <Pressable style={styles.currentJobCard} onPress={handleOpenCurrentJob}>
              <CategoryIcon categoryId={currentJobCategory.id} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.currentJobCustomerRow}>
                  <User size={12} color={colors.mutedForeground} />
                  <Text style={styles.currentJobCustomer} numberOfLines={1}>
                    {currentJob.customer}
                  </Text>
                </View>
                <Text style={styles.currentJobCategoryText}>{currentJobCategory.label}</Text>
                <View style={styles.currentJobMetaRow}>
                  <Clock size={11} color={colors.mutedForeground} />
                  <Text style={styles.currentJobMetaText}>{currentJob.date}</Text>
                  <MapPin size={11} color={colors.mutedForeground} />
                  <Text style={styles.currentJobMetaText}>{currentJob.location}</Text>
                </View>
              </View>
              <View style={styles.currentJobRight}>
                <StatusPill status="active" />
                <ChevronRight size={16} color={colors.mutedForeground} />
              </View>
            </Pressable>
          </View>
        )}

        <View style={styles.feedSection}>
          <View style={styles.feedHeaderRow}>
            <View>
              <Text style={styles.feedTitle}>ახალი მოთხოვნები</Text>
              <Text style={styles.feedSubtitle}>შენს სამუშაო არეალში</Text>
            </View>
            <View style={styles.feedCountBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.feedCountText}>{filtered.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardsSection}>
          {isLoading ? (
            [0, 1, 2].map((i) => <ProviderFeedJobCardSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Briefcase size={20} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>ახალი მოთხოვნები ჯერ არ არის</Text>
              <Text style={styles.emptySubtitle}>შენს კატეგორიასა და არეალში ახალი მოთხოვნა გამოჩნდება.</Text>
            </View>
          ) : (
            <>
              {homeFeed.map((job) => (
                <ProviderFeedJobCard
                  key={job.id}
                  job={job}
                  sent={interests.has(job.id)}
                  onDetail={() => handleJobDetail(job.id)}
                  onInterested={() => markInterested(job.id)}
                  onChat={() => handleOpenChat(job)}
                />
              ))}
              <Pressable style={styles.viewAllButton} onPress={handleViewAllFeed}>
                <Text style={styles.viewAllButtonText}>ყველას ნახვა</Text>
                <ChevronRight size={15} color={colors.primary} />
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
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.h2,
    color: colors.foreground,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: spacing.xl,
  },
  topCards: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  availabilityCardOn: {
    backgroundColor: colors.successBackground,
    borderColor: '#A7F3D0',
  },
  availabilityCardOff: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
    minWidth: 0,
  },
  availabilityIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityIconOn: {
    backgroundColor: '#D1FAE5',
  },
  availabilityIconOff: {
    backgroundColor: colors.border,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availabilityTitle: {
    ...typography.captionMedium,
    fontWeight: '700',
  },
  availabilitySubtitle: {
    ...typography.small,
  },
  statsCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statsLabel: {
    ...typography.small,
    color: '#BFDBFE',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm + 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  statValue: {
    ...typography.captionMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    color: '#BFDBFE',
  },
  feedSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  feedTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  feedSubtitle: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  feedCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  feedCountText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  cardsSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.md,
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
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
  },
  emptyTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.sm + 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
  },
  viewAllButtonText: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  currentJobSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  currentJobSectionTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginBottom: spacing.sm + 2,
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
  currentJobCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentJobCustomer: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
    flexShrink: 1,
  },
  currentJobCategoryText: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  currentJobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  currentJobMetaText: {
    ...typography.small,
    color: colors.mutedForeground,
    marginRight: spacing.xs + 2,
  },
  currentJobRight: {
    alignItems: 'flex-end',
    gap: spacing.xs + 2,
  },
});
