import React from 'react';
import { Text, View } from 'react-native';
import { radius } from '../theme';
import { CATEGORIES } from '../data/categories';

type Props = {
  categoryId: string;
  size?: number;
};

// კატეგორიის ფერადი აიქონი (დიზაინის რეფერენსის CatIcon-ის მიხედვით)
export function CategoryIcon({ categoryId, size = 36 }: Props) {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: category.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.48 }}>{category.icon}</Text>
    </View>
  );
}
