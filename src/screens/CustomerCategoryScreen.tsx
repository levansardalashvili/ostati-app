import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { ProviderCard } from '../components/ProviderCard';
import { StartJobChatSheet } from '../components/StartJobChatSheet';
import { colors, radius, spacing, typography } from '../theme';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import type { Provider } from '../types/provider';
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
    () => allProviders.filter((p) => p.categories.includes(route.params.id)),
    [allProviders, route.params.id],
  );

  // StartJobChatSheet-ის wiring — CustomerProviderListScreen-ის იგივე (#99)
  const [startChatProvider, setStartChatProvider] = useState<Provider | null>(null);
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
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onOpenProfile={() => navigation.navigate('ViewProviderProfile', { id: p.id })}
              onMessage={() => setStartChatProvider(p)}
            />
          ))}
        </ScrollView>
      )}
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.md,
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
