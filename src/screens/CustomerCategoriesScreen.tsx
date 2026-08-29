import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { getCategoryIcon } from '../components/CategoryIcon';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerCategories'>;

// CustomerCategories — "ყველა სერვისი" ღილაკის გვერდი: ყველა სერვისის
// კატეგორიის ბადე. კატეგორიაზე დაჭერით იხსნება CustomerCategoryScreen —
// იმ კატეგორიის ოსტატების სია.
export function CustomerCategoriesScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ყველა სერვისი" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const Icon = getCategoryIcon(c.id);
            return (
              <Pressable
                key={c.id}
                style={styles.card}
                onPress={() => navigation.navigate('CustomerCategory', { id: c.id })}
              >
                <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
                  <Icon size={22} color={c.dot} strokeWidth={2} />
                </View>
                <Text style={styles.label} numberOfLines={2}>
                  {c.label}
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
