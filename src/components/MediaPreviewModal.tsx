import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2, X, type LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { MediaItem } from './MediaUploadGrid';

type Props = {
  item: MediaItem | null;
  icon: LucideIcon;
  onClose: () => void;
  onDelete?: (id: number) => void;
};

// ატვირთული ფაილის დიდი preview — Modal-ის ფონზე დაჭერით ან
// "დახურვა"-ზე იხურება; onDelete გადაცემისას ჩანს "წაშლა"-ც.
export function MediaPreviewModal({ item, icon: Icon, onClose, onDelete }: Props) {
  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: item.bg }]} onPress={() => {}}>
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={styles.cardImage} />
          ) : (
            <Icon size={48} color="rgba(100,116,139,0.6)" />
          )}
        </Pressable>
        <View style={styles.actions}>
          {onDelete && (
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                onDelete(item.id);
                onClose();
              }}
            >
              <Trash2 size={16} color={colors.destructive} />
              <Text style={styles.actionTextDanger}>წაშლა</Text>
            </Pressable>
          )}
          <Pressable style={styles.actionButton} onPress={onClose}>
            <X size={16} color={colors.foreground} />
            <Text style={styles.actionText}>დახურვა</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  actionText: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  actionTextDanger: {
    ...typography.captionMedium,
    color: colors.destructive,
    fontWeight: '600',
  },
});
