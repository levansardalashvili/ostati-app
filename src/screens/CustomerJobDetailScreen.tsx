import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Check, Clock, MapPin, MessageCircle, MoreVertical, Pencil, Star, X, Zap, Image as ImageIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CategoryIcon } from '../components/CategoryIcon';
import { StatusPill, type JobStatus } from '../components/StatusPill';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTY_LABEL } from '../data/categories';
import { CUSTOMER_JOBS, INTERESTED_PROVIDERS, PHOTO_COLORS, Provider } from '../data/mockHomeData';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerJobDetail'>;

// C3 — Job-ის დეტალი + დაინტერესებული ოსტატების სია, და C4 — ოსტატის
// არჩევის დადასტურება (product-spec.md; დიზაინის რეფერენსში ეს ორივე ერთი
// და იმავე CustomerJobDetail კომპონენტის ორი მდგომარეობაა — ჩვენც ასე
// ავაშენეთ). სამუშაოს დასრულების/შეფასების ნაკადი (product-spec.md-ის
// ცალკე პუნქტი #14) ამ ეტაპზე გამოტოვებულია.
export function CustomerJobDetailScreen({ navigation, route }: Props) {
  const job = useMemo(
    () => CUSTOMER_JOBS.find((j) => j.id === route.params.jobId) ?? CUSTOMER_JOBS[1],
    [route.params.jobId],
  );
  const interestedList = INTERESTED_PROVIDERS[job.id] ?? [];

  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [confirmProvider, setConfirmProvider] = useState<Provider | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    () => interestedList.find((p) => p.name === job.provider) ?? null,
  );

  const effectiveStatus: JobStatus = cancelled ? 'cancelled' : selectedProvider ? 'active' : job.status;

  const progressSteps = [
    { label: 'მოთხოვნა გამოქვეყნდა', done: true },
    { label: 'ოსტატი შეირჩა', done: !!selectedProvider },
    { label: 'სამუშაო დასრულდა', done: false },
  ];

  const handleEdit = () => {
    // TODO: სამუშაოს რედაქტირების ეკრანი ჯერ არ არსებობს
    setMenuOpen(false);
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
  const handleOpenProfile = (_provider: Provider) => {
    // TODO: Provider Profile ეკრანი ჯერ არ არსებობს
  };
  const confirmSelection = () => {
    if (!confirmProvider) return;
    setSelectedProvider(confirmProvider);
    setConfirmProvider(null);
  };
  const confirmCancel = () => {
    setCancelled(true);
    setCancelSheetOpen(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader
        title="მოთხოვნის დეტალები"
        onBack={() => navigation.goBack()}
        right={
          <Pressable style={styles.iconButton} onPress={() => setMenuOpen(true)}>
            <MoreVertical size={18} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.jobCard}>
          <View style={styles.jobHeaderRow}>
            <CategoryIcon categoryId={job.category} size={44} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleStatusRow}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <StatusPill status={effectiveStatus} />
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MapPin size={11} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.address}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={11} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.date}</Text>
                </View>
              </View>
            </View>
          </View>

          {job.budget && (
            <View style={styles.budgetRow}>
              <View style={styles.budgetBadge}>
                <Text style={styles.budgetBadgeText}>ბიუჯეტი: {job.budget}</Text>
              </View>
              {job.id === 'j1' && (
                <View style={styles.urgentBadge}>
                  <Zap size={11} color={colors.destructive} />
                  <Text style={styles.urgentBadgeText}>გადაუდებელი</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.jobDesc}>{job.desc}</Text>

          {job.id !== 'j3' && (
            <View style={styles.photoRow}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.photoThumb, { backgroundColor: PHOTO_COLORS[i] }]}>
                  <ImageIcon size={20} color="rgba(100,116,139,0.6)" />
                </View>
              ))}
            </View>
          )}
        </View>

        {selectedProvider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>სამუშაოს პროგრესი</Text>
            {progressSteps.map((step, i) => (
              <View key={i} style={styles.progressRow}>
                <View style={styles.progressIconColumn}>
                  <View style={[styles.progressDot, step.done && styles.progressDotDone]}>
                    {step.done ? (
                      <Check size={14} color={colors.primaryForeground} strokeWidth={2.5} />
                    ) : (
                      <View style={styles.progressDotInner} />
                    )}
                  </View>
                  {i < progressSteps.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        step.done && progressSteps[i + 1].done && styles.progressLineDone,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.progressTextWrap}>
                  <Text style={[styles.progressLabel, step.done && styles.progressLabelDone]}>{step.label}</Text>
                  {i === 1 && selectedProvider && <Text style={styles.progressProviderName}>{selectedProvider.name}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.interestedSection}>
          <View style={styles.interestedHeaderRow}>
            <Text style={styles.interestedTitle}>დაინტერესებული ოსტატები</Text>
            {interestedList.length > 0 && (
              <View style={styles.interestedCountBadge}>
                <Text style={styles.interestedCountText}>{interestedList.length}</Text>
              </View>
            )}
          </View>

          {interestedList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Briefcase size={22} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyText}>
                ჯერ არ გაუხატეს ინტერესი.{'\n'}ოსტატები მალე გამოეხმაურებიან.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {interestedList.map((prov) => {
                const isSelected = selectedProvider?.id === prov.id;
                return (
                  <View key={prov.id} style={[styles.providerCard, isSelected && styles.providerCardSelected]}>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Check size={13} color={colors.primary} strokeWidth={2.5} />
                        <Text style={styles.selectedBadgeText}>შერჩეული ოსტატი</Text>
                      </View>
                    )}
                    <View style={styles.providerRow}>
                      <Avatar initials={prov.initials} color={prov.color} size={46} online={prov.online} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.providerNameRow}>
                          <Text style={styles.providerName}>{prov.name}</Text>
                          {prov.verified && <VerifiedBadge size={14} />}
                        </View>
                        <Text style={styles.providerMeta}>
                          {SPECIALTY_LABEL[prov.category] ?? prov.category} · {prov.years} წელი
                        </Text>
                        <View style={styles.providerStatsRow}>
                          <View style={styles.providerStat}>
                            <Star size={11} color="#FBBF24" fill="#FBBF24" />
                            <Text style={styles.providerStatText}>{prov.rating}</Text>
                          </View>
                          <Text style={styles.providerStatMuted}>{prov.reviews} შეფ.</Text>
                          <Text style={styles.providerStatMuted}>{prov.jobs} სამ.</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.providerActions}>
                      <Pressable style={styles.secondaryAction} onPress={() => handleOpenProfile(prov)}>
                        <Text style={styles.secondaryActionText}>პროფილი</Text>
                      </Pressable>
                      <Pressable style={styles.secondaryAction} onPress={() => handleOpenChat(prov)}>
                        <MessageCircle size={12} color={colors.foreground} />
                        <Text style={styles.secondaryActionText}>მიწერა</Text>
                      </Pressable>
                      {!selectedProvider && (
                        <Pressable style={styles.selectAction} onPress={() => setConfirmProvider(prov)}>
                          <Text style={styles.selectActionText}>არჩევა</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {effectiveStatus === 'pending' && (
          <Pressable style={styles.menuRow} onPress={handleEdit}>
            <Pencil size={15} color={colors.mutedForeground} />
            <Text style={styles.menuRowText}>სამუშაოს რედაქტირება</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.menuRow}
          onPress={() => {
            setMenuOpen(false);
            setCancelSheetOpen(true);
          }}
        >
          <X size={15} color={colors.destructive} />
          <Text style={[styles.menuRowText, { color: colors.destructive }]}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={!!confirmProvider} onClose={() => setConfirmProvider(null)}>
        {confirmProvider && (
          <>
            <Text style={styles.sheetTitle}>ოსტატის არჩევა</Text>
            <Text style={styles.sheetSubtitle}>
              გსურთ <Text style={styles.sheetSubtitleBold}>{confirmProvider.name}</Text>-ის დანიშვნა ამ სამუშაოსთვის?
            </Text>
            <View style={styles.sheetProviderRow}>
              <Avatar initials={confirmProvider.initials} color={confirmProvider.color} size={44} />
              <View>
                <View style={styles.providerNameRow}>
                  <Text style={styles.providerName}>{confirmProvider.name}</Text>
                  {confirmProvider.verified && <VerifiedBadge size={13} />}
                </View>
                <View style={styles.providerStat}>
                  <Star size={11} color="#FBBF24" fill="#FBBF24" />
                  <Text style={styles.providerStatText}>{confirmProvider.rating}</Text>
                  <Text style={styles.providerStatMuted}> · {confirmProvider.reviews} შეფ.</Text>
                </View>
              </View>
            </View>
            <Button label="დადასტურება" onPress={confirmSelection} />
            <Pressable style={styles.sheetCancelLink} onPress={() => setConfirmProvider(null)}>
              <Text style={styles.sheetCancelLinkText}>გაუქმება</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>

      <BottomSheet visible={cancelSheetOpen} onClose={() => setCancelSheetOpen(false)}>
        <View style={styles.cancelIcon}>
          <X size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>მოთხოვნის გაუქმება</Text>
        <Text style={styles.sheetSubtitle}>ნამდვილად გსურთ ამ სამუშაო მოთხოვნის გაუქმება?</Text>
        <Button label="გაუქმება" variant="destructive" onPress={confirmCancel} />
        <Pressable style={styles.sheetCancelLink} onPress={() => setCancelSheetOpen(false)}>
          <Text style={styles.sheetCancelLinkText}>დახურვა</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: spacing.xxl,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  titleStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  jobTitle: {
    ...typography.h3,
    color: colors.foreground,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  budgetBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  budgetBadgeText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '700',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerBackground,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  urgentBadgeText: {
    ...typography.small,
    color: colors.destructive,
    fontWeight: '700',
  },
  jobDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  progressIconColumn: {
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressLine: {
    width: 2,
    height: 24,
    marginTop: 2,
    backgroundColor: colors.border,
  },
  progressLineDone: {
    backgroundColor: colors.primary,
  },
  progressTextWrap: {
    paddingBottom: spacing.lg,
  },
  progressLabel: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
  progressLabelDone: {
    color: colors.foreground,
  },
  progressProviderName: {
    ...typography.small,
    color: colors.primary,
    marginTop: 2,
  },
  interestedSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  interestedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  interestedTitle: {
    ...typography.h3,
    color: colors.foreground,
  },
  interestedCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  interestedCountText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '700',
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
  emptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  providerCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  providerCardSelected: {
    borderColor: colors.primary,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm + 2,
    alignSelf: 'flex-start',
  },
  selectedBadgeText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  providerName: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  providerMeta: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  providerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.xs + 2,
  },
  providerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  providerStatText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  providerStatMuted: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  providerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '600',
  },
  selectAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  selectActionText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  menuRowText: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sheetSubtitleBold: {
    color: colors.foreground,
    fontWeight: '700',
  },
  sheetProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sheetCancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sheetCancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
  cancelIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm + 2,
  },
});
