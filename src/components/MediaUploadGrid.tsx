import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Image as ImageIcon, X, type LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import { SecureStorageImage } from './SecureStorageImage';
import { usePressScale } from '../utils/usePressScale';

// `uri` — არასავალდებულო, ლოკალური ან Supabase Storage-ის საჯარო URL (#62) —
// თუ არსებობს, რეალური სურათი რენდერდება ფერადი placeholder-ის ნაცვლად.
export type MediaItem = { id: number; bg: string; uri?: string };

export const MEDIA_BG = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE'];

// Profile-fix pass, task 2 — `id: Date.now() + items.length` could produce
// the SAME id from two INDEPENDENT calls (e.g. one for `certificates`, one
// for `portfolio`, each with its own array length) if they land within the
// same millisecond — a real, confirmed anomaly (DEFAULT_PROVIDER_PROFILE's
// mock seed data in userService.ts had exactly this: certificates id=1 and
// the first portfolio id=1). A module-level, monotonically increasing
// counter guarantees every id this function ever returns — across every
// caller, every array, every screen using it — is unique, closing that off
// completely regardless of timing.
let mediaItemSeq = 0;

export function nextMediaItem(items: MediaItem[]): MediaItem {
  mediaItemSeq += 1;
  return { id: Date.now() * 1000 + mediaItemSeq, bg: MEDIA_BG[items.length % MEDIA_BG.length] };
}

type Props = {
  items: MediaItem[];
  onAddCamera: () => void;
  onAddGallery: () => void;
  onRemove: (id: number) => void;
  onPreview: (item: MediaItem) => void;
  icon: LucideIcon;
  addLabelPrimary?: string;
  addLabelSecondary?: string;
  // E2E (Maestro) support — a screen can render more than one grid (e.g.
  // ProviderEditProfileScreen's certificates AND portfolio sections both
  // say "გადაღება"/"გალერეა"), which text-based selectors can't
  // disambiguate.
  testID?: string;
};

// ერთი გაზიარებული ბადე ატვირთული ფაილებისთვის (სერთიფიკატები/ნამუშევრები/
// RatingScreen-ის ფოტოები) — რეალური კამერა/გალერეის picker-ით (#62),
// preview/დამატება/წაშლა PostJobScreen-ის ფოტოს ატვირთვის იგივე
// ვიზუალური ენით.
export function MediaUploadGrid({
  items,
  onAddCamera,
  onAddGallery,
  onRemove,
  onPreview,
  icon: Icon,
  addLabelPrimary = 'გადაღება',
  addLabelSecondary = 'გალერეა',
  testID,
}: Props) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <MediaThumb key={item.id} item={item} Icon={Icon} onPreview={() => onPreview(item)} onRemove={() => onRemove(item.id)} />
      ))}
      <AddTile testID={testID && `${testID}-camera`} icon={Camera} label={addLabelPrimary} onPress={onAddCamera} />
      <AddTile testID={testID && `${testID}-gallery`} icon={ImageIcon} label={addLabelSecondary} onPress={onAddGallery} />
    </View>
  );
}

function MediaThumb({
  item,
  Icon,
  onPreview,
  onRemove,
}: {
  item: MediaItem;
  Icon: LucideIcon;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.thumb, { backgroundColor: item.bg }]}
        onPress={onPreview}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {item.uri ? (
          <SecureStorageImage reference={item.uri} style={styles.thumbImage} />
        ) : (
          <Icon size={20} color="rgba(100,116,139,0.5)" />
        )}
        <Pressable style={styles.remove} onPress={onRemove} hitSlop={8}>
          <X size={10} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function AddTile({
  testID,
  icon: Icon,
  label,
  onPress,
}: {
  testID?: string;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable testID={testID} style={styles.addButton} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Icon size={18} color={colors.mutedForeground} />
        <Text style={styles.addText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
    fontSize: 10,
  },
});
