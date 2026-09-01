import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { getCategoryIcon } from '../components/CategoryIcon';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { categoryService } from '../services/categoryService';
import type { CategoryRecord } from '../types/category';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerCategories'>;

// CustomerCategories — "ყველა სერვისი" ღილაკის გვერდი: ყველა სერვისის
// კატეგორიის ბადე. კატეგორიაზე დაჭერით იხსნება CustomerCategoryScreen —
// იმ კატეგორიის ოსტატების სია.
//
// Task 6 (audit) — სია/სახელი/რიგითობა/აქტიურობა ბექენდიდანაა
// (`categories`, supabase/migrations/0043); bg/dot ფერები კვლავ
// ლოკალურია (`src/data/categories.ts`, დიზაინის ტოკენი, არა backend-მონაცემი).
export function CustomerCategoriesScreen({ navigation }: Props) {
  const [categoryList, setCategoryList] = useState<CategoryRecord[]>(() => categoryService.getCached());
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
  const activeCategories = [...categoryList].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ყველა სერვისი" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.grid}>
          {activeCategories.map((c) => {
            const Icon = getCategoryIcon(c.id);
            const style = CATEGORIES.find((sc) => sc.id === c.id);
            return (
              <Pressable
                key={c.id}
                style={styles.card}
                onPress={() => navigation.navigate('CustomerCategory', { id: c.id })}
              >
                <View style={[styles.iconWrap, { backgroundColor: style?.bg ?? colors.muted }]}>
                  <Icon size={22} color={style?.dot ?? colors.mutedForeground} strokeWidth={2} />
                </View>
                <Text style={styles.label} numberOfLines={2}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  card: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '600',
    textAlign: 'center',
  },
});
