import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Settings } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Skeleton } from '../components/Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import type { NotificationEntry } from '../types/notification';
import { navigateToNotificationTarget } from '../utils/notificationNavigation';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

// Notifications — საერთო ეკრანი Customer/Provider-ისთვის, `notifications`
// ცხრილზე (#70) აგებული.
export function NotificationsScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) {
        setIsLoading(false);
        return;
      }
      notificationService
        .listMine(uid)
        .then((real) => {
          if (!cancelled) setItems(real);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [role]),
  );

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    notificationService.markRead(id).catch(() => {});
  };
  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const uid = authService.getCurrentUser()?.uid;
    if (uid) notificationService.markAllRead(uid).catch(() => {});
  };

  const handleTap = (item: NotificationEntry) => {
    markRead(item.id);
    navigateToNotificationTarget(navigation.navigate, item.target, role);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>შეტყობინებები</Text>
            {unreadCount > 0 && (
              <View style={styles.headerCountBadge}>
                <Text style={styles.headerCountText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={styles.markAllText}>ყველა წაკითხ.</Text>
            </Pressable>
          )}
          <Pressable style={styles.iconButtonSm} onPress={() => navigation.navigate('NotificationSettings', { role })}>
            <Settings size={15} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.body}>
          {[0, 1, 2, 3, 4].map((i) => (
            <NotifRowSkeleton key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={28} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>შეტყობინებები ჯერ არ გაქვს</Text>
          <Text style={styles.emptySubtitle}>ახალი აქტივობა აქ გამოჩნდება.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => handleTap(item)}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                {item.iconType === 'avatar' ? (
                  <Text style={styles.iconInitials}>{item.iconInitials}</Text>
                ) : (
                  <Text style={styles.iconEmoji}>{item.iconEmoji}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.rowTopRight}>
                    <Text style={styles.time}>{item.time}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                </View>
                <Text style={styles.text} numberOfLines={2}>
                  {item.text}
                </Text>
              </View>
            </Pressable>
          ))}
          <View style={styles.footer}>
            <Text style={styles.footerText}>სულ {items.length} შეტყობინება</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotifRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} borderRadius={radius.full} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width="55%" height={12} />
          <Skeleton width={40} height={10} />
        </View>
        <Skeleton width="75%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  headerCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  headerCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  markAllText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  iconButtonSm: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
    backgroundColor: colors.card,
  },
  rowUnread: {
    backgroundColor: colors.secondary,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  iconInitials: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  title: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '600',
    flexShrink: 1,
  },
  titleUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 10.5,
    color: colors.mutedForeground,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  text: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.card,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
