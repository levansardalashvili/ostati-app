import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Image as ImageIcon, X, type LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

export type MediaItem = { id: number; bg: string };

export const MEDIA_BG = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE'];

export function nextMediaItem(items: MediaItem[]): MediaItem {
  return { id: Date.now() + items.length, bg: MEDIA_BG[items.length % MEDIA_BG.length] };
}

type Props = {
  items: MediaItem[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onPreview: (item: MediaItem) => void;
  icon: LucideIcon;
  addLabelPrimary?: string;
  addLabelSecondary?: string;
};

// ერთი გაზიარებული ბადე ატვირთული ფაილებისთვის (სერთიფიკატები/ნამუშევრები) —
// mock ატვირთვა (ფერადი ჩანაცვლების ფირფიტა), preview/დამატება/წაშლა
// PostJobScreen-ის ფოტოს ატვირთვის იგივე ვიზუალური ენით.
export function MediaUploadGrid({
  items,
  onAdd,
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
          <Icon size={20} color="rgba(100,116,139,0.5)" />
          <Pressable style={styles.remove} onPress={() => onRemove(item.id)} hitSlop={8}>
            <X size={10} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </Pressable>
      ))}
      <Pressable style={styles.addButton} onPress={onAdd}>
        <Camera size={18} color={colors.mutedForeground} />
        <Text style={styles.addText}>{addLabelPrimary}</Text>
      </Pressable>
      <Pressable style={styles.addButton} onPress={onAdd}>
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
