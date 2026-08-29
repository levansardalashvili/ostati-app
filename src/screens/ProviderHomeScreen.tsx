import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Briefcase, ChevronRight, Clock, MapPin, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { CategoryIcon } from '../components/CategoryIcon';
import { OfferPriceSheet } from '../components/OfferPriceSheet';
import { ProviderFeedJobCard, ProviderFeedJobCardSkeleton } from '../components/ProviderFeedJobCard';
import { StatusPill } from '../components/StatusPill';
import { Switch } from '../components/Switch';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { notificationService } from '../services/notificationService';
import { quoteService } from '../services/quoteService';
import { userService } from '../services/userService';
import { useJobStatus } from '../state/JobStatusContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { FeedJob } from '../types/job';
import type { ProviderTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ProviderTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;


// Home-ზე მხოლოდ ბოლო 5 შესაბამისი მოთხოვნაა ჩანს — დანარჩენის სანახავად
// "ყველას ნახვა" ხსნის სრულ Feed-ს (ProviderJobFeedScreen).
const HOME_FEED_LIMIT = 5;

// B1 — Provider Home (product-spec.md; დიზაინის რეფერენსის ProviderHome-ის
// მიხედვით)
export function ProviderHomeScreen({ navigation }: Props) {
  // `available` მხოლოდ push-შეტყობინებებზე მოქმედებს — Job Feed (`filtered`)
  // მისგან დამოუკიდებელია და OFF-ის დროსაც ჩანს (მომხმარებლის მოთხოვნით).
  // Task 2 — რეალურად Supabase-ზე (`provider_profiles.is_available`),
  // აღდგება app restart-ის შემდეგაც.
  const [available, setAvailable] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    let cancelled = false;
    userService
      .getProviderAvailability(uid)
      .then((value) => {
        if (!cancelled) setAvailable(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const toggleAvailability = async (next: boolean) => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid || availabilitySaving) return;
    setAvailable(next);
    setAvailabilitySaving(true);
    try {
      await userService.setProviderAvailability(uid, next);
    } catch {
      setAvailable(!next);
      Alert.alert('ვერ მოხერხდა', 'ხელმისაწვდომობის განახლება ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setAvailabilitySaving(false);
    }
  };
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filtered, setFiltered] = useState<FeedJob[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<FeedJob[]>([]);
  const { profile: providerProfile } = useProviderProfile();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      const uid = authService.getCurrentUser()?.uid;
      Promise.all([
        jobService.getOpenProviderFeedPosts(),
        uid ? quoteService.listMyResponseJobIds(uid) : Promise.resolve(new Set<string>()),
        uid ? jobService.listMyAssignedJobs(uid) : Promise.resolve([]),
      ])
        .then(([jobs, myResponses, assigned]) => {
          if (cancelled) return;
          setFiltered(jobs);
          setInterests(myResponses);
          setAssignedJobs(assigned);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // "მიმდინარე სამუშაო" — job, რომელზეც Customer-მა სწორედ ეს Provider აირჩია.
  // რეალურად job_posts.provider_id=me-ზეა აგებული (#69) — mock
  // PROVIDER_FEED/CURRENT_PROVIDER_ID მექანიზმი (#30/#47) აღარ გამოიყენება.
  // `completed`/`cancelled` სტატუსზე გადასვლის შემდეგ ეს ბარათი Home-ზეც
  // აღარ ჩანს — აღარ არის "მიმდინარე".
  const { getStatus } = useJobStatus();
  const currentJobCandidate =
    assignedJobs.find((j) => {
      const liveStatus = j.customerJobId ? (getStatus(j.customerJobId) ?? j.status) : j.status;
      return liveStatus !== 'completed' && liveStatus !== 'cancelled';
    }) ?? null;
  const currentJobStatus = currentJobCandidate?.customerJobId
    ? (getStatus(currentJobCandidate.customerJobId) ?? currentJobCandidate.status)
    : currentJobCandidate?.status;
  const currentJob = currentJobStatus === 'completed' ? null : currentJobCandidate;
  const currentJobCategory = currentJob ? CATEGORIES.find((c) => c.id === currentJob.category) : null;

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    return notificationService.subscribeToUnreadCount(uid, setUnreadNotifCount);
  }, []);

  // "ამ თვის სტატისტიკა" ბარათის რეალური მონაცემები (#71) — ადრე ჰარდქოდილი
  // "14 სამ. / 2,840₾ შემოს. / 4.9★ შეფ." იყო. შემოსავლის სტატისტიკა
  // ამოღებულია მთლიანად — აპში ფასის აგრეგაცია საერთოდ არ არსებობს (#35),
  // ამიტომ ნამდვილი "შემოს." რიცხვი ფიზიკურად ვერ გამოითვლება.
  const [stats, setStats] = useState({ jobs: 0, rating: 0, reviews: 0 });
  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    let cancelled = false;
    userService
      .getRealProviderById(uid)
      .then((real) => {
        if (!cancelled && real) setStats({ jobs: real.jobs, rating: real.rating, reviews: real.reviews });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const homeStats = [
    { key: 'jobs', value: String(stats.jobs), label: 'სამ.' },
    { key: 'rating', value: stats.reviews === 0 ? '—' : `${stats.rating.toFixed(1)}★`, label: 'შეფ.' },
  ];

  const homeFeed = filtered.slice(0, HOME_FEED_LIMIT);

  const handleNotifications = () => {
    navigation.navigate('Notifications', { role: 'provider' });
  };
  const handleJobDetail = (job: FeedJob) => {
    navigation.navigate('ProviderJobDetail', { id: job.id, job });
  };
  const handleOpenCurrentJob = () => {
    if (!currentJob) return;
    navigation.navigate('ProviderJobDetail', { id: currentJob.id, mode: 'selected' });
  };
  const handleViewAllFeed = () => {
    navigation.navigate('ProviderJobFeed');
  };
  const handleOpenChat = (job: FeedJob) => {
    if (!job.customerId) return;
    navigation.navigate('ChatConversation', {
      chatId: job.customerId,
      name: job.customer,
      initials: job.customer[0],
      color: '#64748B',
      role: 'provider',
    });
  };
  // #72: ფასი სავალდებულო, კონკრეტული რიცხვია — Job Feed-ის ბარათის
  // "დაინტ. ვარ" ერთი-შეხებით ღილაკს ვეღარ შეუძლია პირდაპირ, ფასის
  // გარეშე ინტერესის გაგზავნა, ამიტომ ჯერ ფასის prompt-ს ხსნის
  // (OfferPriceSheet, ProviderJobDetailScreen-ის იგივე კომპონენტი).
  const [offerJob, setOfferJob] = useState<FeedJob | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [sendingInterest, setSendingInterest] = useState(false);
  const closeOfferSheet = () => {
    setOfferJob(null);
    setOfferPrice('');
  };
  const confirmInterest = async () => {
    const priceNum = Number(offerPrice);
    if (!offerJob || !offerPrice || priceNum <= 0 || sendingInterest) return;
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    setSendingInterest(true);
    try {
      await quoteService.expressInterest(
        offerJob.id,
        {
          id: uid,
          name: `${providerProfile.firstName} ${providerProfile.lastName}`.trim(),
          initials: `${providerProfile.firstName.charAt(0)}${providerProfile.lastName.charAt(0)}`,
          color: colors.primary,
        },
        priceNum,
      );
      setInterests((prev) => {
        const next = new Set(prev);
        next.add(offerJob.id);
        return next;
      });
      closeOfferSheet();
    } catch {
      Alert.alert('ვერ მოხერხდა', 'ინტერესის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setSendingInterest(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              გამარჯობა, {providerProfile.firstName || 'ოსტატო'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Avatar
              initials={`${providerProfile.firstName.charAt(0)}${providerProfile.lastName.charAt(0)}`}
              color={colors.primary}
              size={38}
              uri={providerProfile.photoUrl}
            />
            <Pressable style={styles.bellButton} onPress={handleNotifications}>
              <Bell size={19} color={colors.foreground} strokeWidth={1.8} />
              {unreadNotifCount > 0 && <View style={styles.bellDot} />}
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
            <Switch value={available} onValueChange={toggleAvailability} />
          </View>

          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            style={styles.statsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.statsLabel}>სტატისტიკა</Text>
            <View style={styles.statsRow}>
              {homeStats.map((s) =>
                s.key === 'jobs' ? (
                  <Pressable key={s.key} style={styles.statBox} onPress={() => navigation.navigate('MyJobsTab')}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </Pressable>
                ) : (
                  <View key={s.key} style={styles.statBox}>
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
                <StatusPill status={currentJobStatus ?? 'active'} />
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
                  onDetail={() => handleJobDetail(job)}
                  onInterested={() => setOfferJob(job)}
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

      <OfferPriceSheet
        visible={!!offerJob}
        price={offerPrice}
        onChangePrice={setOfferPrice}
        onSubmit={confirmInterest}
        onClose={closeOfferSheet}
        submitting={sendingInterest}
      />
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
