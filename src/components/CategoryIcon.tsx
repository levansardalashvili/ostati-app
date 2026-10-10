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

// Category id → Lucide icon, for the whole app.
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

// Just the icon, for callers that draw their own container.
export function getCategoryIcon(categoryId: string): LucideIcon {
  return CATEGORY_ICON_MAP[categoryId] ?? DEFAULT_ICON;
}

type Props = {
  categoryId: string;
  size?: number;
};

// Icon in a pastel container with the category color.
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
