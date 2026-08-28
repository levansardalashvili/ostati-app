import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Search } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { chatService } from '../services/chatService';
import type { CustomerTabParamList, Role, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Chats'>,
  NativeStackScreenProps<RootStackParamList>
> & { role: Role };

// D1 — ჩატების სია / Inbox (product-spec.md; დიზაინის რეფერენსის
// ChatsList-ის მიხედვით)
export function ChatsListScreen({ navigation, role }: Props) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const chats = useMemo(() => chatService.listChats(), []);
  const filtered = useMemo(
    () => chats.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase())),
    [chats, query],
  );

  const openChat = (chat: (typeof chats)[number]) => {
    navigation.navigate('ChatConversation', {
      chatId: chat.id,
      name: chat.name,
      initials: chat.initials,
      color: chat.color,
      role,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>ჩატები</Text>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ჩატის ძიება..."
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.body}>
          {[0, 1, 2, 3].map((i) => (
            <ChatItemSkeleton key={i} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MessageCircle size={28} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>ჩატები ჯერ არ გაქვს</Text>
          <Text style={styles.emptySubtitle}>
            {role === 'customer'
              ? 'ოსტატთან საუბრის დაწყების შემდეგ ჩატი აქ გამოჩნდება.'
              : 'მომხმარებელთან საუბრის დაწყების შემდეგ ჩატი აქ გამოჩნდება.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.body}>
          {filtered.map((c) => {
            const catEmoji = CATEGORIES.find((cat) => cat.id === c.jobCategory)?.icon ?? '🔧';
            return (
              <Pressable key={c.id} style={styles.row} onPress={() => openChat(c)}>
                <Avatar initials={c.initials} color={c.color} size={50} online={c.online} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, c.unread > 0 && styles.nameUnread]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[styles.time, c.unread > 0 && styles.timeUnread]}>{c.time}</Text>
                  </View>
                  <View style={styles.rowMiddle}>
                    <Text style={[styles.lastMessage, c.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                      {c.last}
                    </Text>
                    {c.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{c.unread}</Text>
                      </View>
                    )}
                  </View>
                  {c.jobTitle && (
                    <Text style={styles.jobLine} numberOfLines={1}>
                      {catEmoji} {c.jobTitle}
                      {c.jobDistrict ? ` · ${c.jobDistrict}` : ''}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ChatItemSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={50} height={50} borderRadius={radius.full} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.sm + 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  searchInput: {
    flex: 1,
    ...typography.caption,
    color: colors.foreground,
    padding: 0,
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
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
    fontWeight: '600',
    flexShrink: 1,
  },
  nameUnread: {
    color: colors.foreground,
    fontWeight: '700',
  },
  time: {
    ...typography.small,
    color: colors.mutedForeground,
    marginLeft: spacing.sm,
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '700',
  },
  rowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 2,
  },
  lastMessage: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  lastMessageUnread: {
    color: colors.foreground,
    fontWeight: '600',
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  jobLine: {
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
