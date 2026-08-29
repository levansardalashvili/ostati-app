import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Image as ImageIcon, X, type LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

// `uri` — არასავალდებულო, ლოკალური ან Supabase Storage-ის საჯარო URL (#62) —
// თუ არსებობს, რეალური სურათი რენდერდება ფერადი placeholder-ის ნაცვლად.
export type MediaItem = { id: number; bg: string; uri?: string };

export const MEDIA_BG = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE'];

export function nextMediaItem(items: MediaItem[]): MediaItem {
  return { id: Date.now() + items.length, bg: MEDIA_BG[items.length % MEDIA_BG.length] };
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
}: Props) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable key={item.id} style={[styles.thumb, { backgroundColor: item.bg }]} onPress={() => onPreview(item)}>
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={styles.thumbImage} />
          ) : (
            <Icon size={20} color="rgba(100,116,139,0.5)" />
          )}
          <Pressable style={styles.remove} onPress={() => onRemove(item.id)} hitSlop={8}>
            <X size={10} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </Pressable>
      ))}
      <Pressable style={styles.addButton} onPress={onAddCamera}>
        <Camera size={18} color={colors.mutedForeground} />
        <Text style={styles.addText}>{addLabelPrimary}</Text>
      </Pressable>
      <Pressable style={styles.addButton} onPress={onAddGallery}>
        <ImageIcon size={18} color={colors.mutedForeground} />
        <Text style={styles.addText}>{addLabelSecondary}</Text>
      </Pressable>
    </View>
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
