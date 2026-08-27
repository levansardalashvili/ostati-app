import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Briefcase,
  Camera,
  ChevronRight,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  ThumbsUp,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { Switch } from '../components/Switch';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { FeedJob, PROVIDER_FEED } from '../data/mockHomeData';
import { getUnreadCount } from '../data/mockNotifications';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MOCK_UNREAD_COUNT = getUnreadCount('provider');
// TODO: რეალური სტატისტიკა Firestore-დან — ჯერჯერობით mock
const MOCK_STATS = [
  { value: '14', label: 'სამ.' },
  { value: '2,840₾', label: 'შემოს.' },
  { value: '4.9★', label: 'შეფ.' },
];

const CAT_OPTS = ['ყველა', 'სანტ.', 'ელექ.', 'ხატ.', 'ავეჯ.', 'კონდ.'];
const CAT_IDS: (string | null)[] = [null, 'plumbing', 'electrical', 'painting', 'furniture', 'ac'];
const AREA_OPTS = ['ყველა', 'ვაკე', 'საბ.', 'ვერა', 'გლდ.'];
const AREA_VALS: (string | null)[] = [null, 'ვაკე', 'საბურთალო', 'ვერა', 'გლდანი'];
const TIME_OPTS = ['ყველა', 'დღეს', 'ხვალ', 'მოქნ.'];
const TIME_VALS: (string | null)[] = [null, 'დღეს', 'ხვალ', 'მოქნ'];

// B1 — Provider Home (product-spec.md; დიზაინის რეფერენსის ProviderHome-ის
// მიხედვით)
export function ProviderHomeScreen({ navigation }: Props) {
  const [available, setAvailable] = useState(true);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [catIdx, setCatIdx] = useState(0);
  const [areaIdx, setAreaIdx] = useState(0);
  const [timeIdx, setTimeIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  const activeCat = CAT_IDS[catIdx];
  const activeArea = AREA_VALS[areaIdx];
  const activeTime = TIME_VALS[timeIdx];

  const filtered = useMemo(() => {
    return PROVIDER_FEED.filter((j) => {
      if (activeCat && j.category !== activeCat) return false;
      if (activeArea && j.location !== activeArea) return false;
      if (activeTime && !j.date.startsWith(activeTime)) return false;
      return true;
    });
  }, [activeCat, activeArea, activeTime]);

  const handleNotifications = () => {
    navigation.navigate('Notifications', { role: 'provider' });
  };
  const handleJobDetail = (id: string) => {
    navigation.navigate('ProviderJobDetail', { id });
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
  const clearFilters = () => {
    setCatIdx(0);
    setAreaIdx(0);
    setTimeIdx(0);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>დილა მშვიდობისა,</Text>
            <Text style={styles.name} numberOfLines={1}>
              გიორგი ბერიძე
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
                  {available ? 'ახალი სამ. შეტყობინებები ჩართულია' : 'პუშ შეტყობინებები გამორთულია'}
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
                  <Pressable key={s.label} style={styles.statBox} onPress={() => navigation.navigate('ProviderMyJobs')}>
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

        <View style={styles.feedSection}>
          <View style={styles.feedHeaderRow}>
            <View>
              <Text style={styles.feedTitle}>ახალი მოთხოვნები</Text>
              <Text style={styles.feedSubtitle}>შენს რაიონში</Text>
            </View>
            <View style={styles.feedCountBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.feedCountText}>{filtered.length}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label={CAT_OPTS[catIdx]} active={catIdx !== 0} onPress={() => setCatIdx((i) => (i + 1) % CAT_OPTS.length)} />
            <FilterChip label={AREA_OPTS[areaIdx]} active={areaIdx !== 0} onPress={() => setAreaIdx((i) => (i + 1) % AREA_OPTS.length)} />
            <FilterChip label={TIME_OPTS[timeIdx]} active={timeIdx !== 0} onPress={() => setTimeIdx((i) => (i + 1) % TIME_OPTS.length)} />
          </ScrollView>
        </View>

        <View style={styles.cardsSection}>
          {isLoading ? (
            [0, 1, 2].map((i) => <JobCardSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Briefcase size={20} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>ახალი მოთხოვნები ჯერ არ არის</Text>
              <Text style={styles.emptySubtitle}>
                {catIdx === 0 && areaIdx === 0
                  ? 'შენს კატეგორიასა და რაიონში ახალი მოთხოვნა გამოჩნდება.'
                  : 'ამ ფილტრებით განცხადებები არ მოიძებნა.'}
              </Text>
              {(catIdx > 0 || areaIdx > 0 || timeIdx > 0) && (
                <Pressable onPress={clearFilters}>
                  <Text style={styles.clearFiltersLink}>ფილტრის გასუფთავება</Text>
                </Pressable>
              )}
            </View>
          ) : (
            filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                sent={interests.has(job.id)}
                onDetail={() => handleJobDetail(job.id)}
                onInterested={() => markInterested(job.id)}
                onChat={() => handleOpenChat(job)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <ChevronRight
        size={10}
        color={active ? '#BFDBFE' : colors.mutedForeground}
        style={{ transform: [{ rotate: '90deg' }] }}
      />
    </Pressable>
  );
}

function JobCard({
  job,
  sent,
  onDetail,
  onInterested,
  onChat,
}: {
  job: FeedJob;
  sent: boolean;
  onDetail: () => void;
  onInterested: () => void;
  onChat: () => void;
}) {
  const category = CATEGORIES.find((c) => c.id === job.category) ?? CATEGORIES[0];

  return (
    <View style={styles.jobCard}>
      <View style={styles.jobCardBody}>
        <View style={styles.jobHeaderRow}>
          <CategoryIcon categoryId={category.id} size={38} />
          <View style={{ flex: 1 }}>
            <View style={styles.jobTitleRow}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              {job.urgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>🔥 სასწ.</Text>
                </View>
              )}
            </View>
            <View style={styles.jobMetaRow}>
              <Text style={styles.jobMetaText}>{category.label}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <View style={styles.jobMetaLocation}>
                <MapPin size={10} color={colors.mutedForeground} />
                <Text style={styles.jobMetaText}>{job.location}</Text>
              </View>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.jobMetaText}>{job.ago} წინ</Text>
            </View>
          </View>
        </View>

        <Text style={styles.jobDesc}>{job.desc}</Text>

        <View style={styles.jobTimeRow}>
          <Clock size={12} color={colors.primary} />
          <Text style={styles.jobTimeText}>{job.date}</Text>
        </View>

        <View style={styles.jobTagsRow}>
          {job.budget && (
            <View style={styles.jobTag}>
              <Text style={styles.jobTagText}>
                სავ. ბიუჯ.: <Text style={styles.jobTagValue}>{job.budget}</Text>
              </Text>
            </View>
          )}
          {job.hasPhoto && (
            <View style={styles.jobTag}>
              <Camera size={10} color={colors.mutedForeground} />
              <Text style={styles.jobTagText}>ფოტოა</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.jobActionRow}>
        <Text style={styles.interestedCount}>{job.interested + (sent ? 1 : 0)} დაინტ.</Text>
        <View style={styles.jobActionButtons}>
          <Pressable style={styles.detailButton} onPress={onDetail}>
            <Text style={styles.detailButtonText}>დეტ. ნახვა</Text>
          </Pressable>
          {sent ? (
            <Pressable style={styles.chatButton} onPress={onChat}>
              <MessageCircle size={13} color={colors.primaryForeground} />
              <Text style={styles.chatButtonText}>ჩატის გახსნა</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.chatButton} onPress={onInterested}>
              <ThumbsUp size={13} color={colors.primaryForeground} />
              <Text style={styles.chatButtonText}>დაინტ. ვარ</Text>
            </Pressable>
          )}
        </View>
      </View>

      {sent && (
        <View style={styles.sentStrip}>
          <Check size={13} color={colors.success} strokeWidth={2.5} />
          <Text style={styles.sentStripText}>ინტერესი გაგზავნილია</Text>
        </View>
      )}
    </View>
  );
}

function JobCardSkeleton() {
  return (
    <View style={[styles.jobCard, { padding: spacing.md, gap: spacing.sm }]}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Skeleton width={38} height={38} borderRadius={radius.md} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="50%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={12} />
      <Skeleton width="60%" height={12} />
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
  greeting: {
    ...typography.small,
    color: colors.mutedForeground,
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
  filterRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
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
  clearFiltersLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  jobCardBody: {
    padding: spacing.md,
    paddingBottom: spacing.sm + 2,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  jobTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    flex: 1,
  },
  urgentBadge: {
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  urgentBadgeText: {
    ...typography.small,
    color: colors.destructive,
    fontWeight: '700',
  },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  jobMetaLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  jobMetaText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  dotSeparator: {
    color: colors.border,
    fontSize: 9,
  },
  jobDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
  },
  jobTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm + 2,
  },
  jobTimeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  jobTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  jobTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  jobTagText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  jobTagValue: {
    fontWeight: '700',
    color: colors.foreground,
  },
  jobActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  interestedCount: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  jobActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailButton: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  detailButtonText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  chatButtonText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  sentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBackground,
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sentStripText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '600',
  },
});
