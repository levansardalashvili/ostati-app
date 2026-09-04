import React from 'react';
import { View } from 'react-native';
import {
  Armchair,
  DoorOpen,
  Flame,
  Grid2X2,
  Hammer,
  House,
  LockKeyhole,
  Package,
  Paintbrush,
  PanelsTopLeft,
  PlugZap,
  Snowflake,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { radius } from '../theme';
import { CATEGORIES } from '../data/categories';
import { specialtyIdToCategoryId } from '../data/specialties';

// ერთადერთი ცენტრალიზებული კატეგორია → Lucide ვექტორული აიქონის მაპინგი
// მთელი აპისთვის (ემოჯის ნაცვლად) — Customer-ის და Provider-ის ეკრანები
// ორივე ამ ერთსა და იმავე მაპინგს იყენებენ, პირდაპირ (CategoryIcon) ან
// getCategoryIcon()-ის საშუალებით (როცა ფონის კონტეინერის ფორმა/ზომა
// უკვე სხვაგან არის განსაზღვრული და მხოლოდ თავად აიქონია საჭირო).
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  painting: Paintbrush,
  ac: Snowflake,
  heating: Flame,
  furniture: Armchair,
  appliance: PlugZap,
  tile: Grid2X2,
  flooring: PanelsTopLeft,
  doors: DoorOpen,
  locks: LockKeyhole,
  repair: Hammer,
  renovation: House,
  cleaning: Sparkles,
  moving: Package,
};

const DEFAULT_ICON: LucideIcon = Wrench;

// კატეგორია/სპეციალობის id-სთვის შესაბამისი Lucide აიქონის კომპონენტი —
// გამოსაყენებელია, როცა უკვე არსებული ფონის კონტეინერის სტილში (ფორმა,
// ზომა, border radius) მხოლოდ თავად აიქონის ჩასმაა საჭირო, `CategoryIcon`-ის
// საკუთარი კონტეინერის გარეშე. სპეციალობის (`plumber`) → კატეგორიის
// (`plumbing`) ალიასი გატანილია src/data/specialties.ts-ში, ერთადერთი
// წყაროდ (userService.ts-იც ამავე ფუნქციას იყენებს Provider.category-ის
// derivation-ისთვის).
export function getCategoryIcon(categoryId: string): LucideIcon {
  return CATEGORY_ICON_MAP[categoryId] ?? CATEGORY_ICON_MAP[specialtyIdToCategoryId(categoryId) ?? ''] ?? DEFAULT_ICON;
}

type Props = {
  categoryId: string;
  size?: number;
};

// კატეგორიის ფერადი აიქონი (დიზაინის რეფერენსის CatIcon-ის მიხედვით) —
// pastel ფონის კონტეინერი + ვექტორული Lucide აიქონი კატეგორიის dot ფერით
// (ემოჯის ნაცვლად — "clean/modern icon system" რეფაქტორი).
export function CategoryIcon({ categoryId, size = 36 }: Props) {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;
  const Icon = getCategoryIcon(categoryId);

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
      <Icon size={size * 0.5} color={category.dot} strokeWidth={2} />
    </View>
  );
}
