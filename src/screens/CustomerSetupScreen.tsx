import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Check, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerSetup'>;

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

// A4 — პროფილის შევსება (Customer) — მარტივი ფოტოს დამატების ეკრანი
// (product-spec.md; დიზაინის რეფერენსის CustomerSetupScreen-ის მიხედვით)
export function CustomerSetupScreen({ navigation, route }: Props) {
  const { userName } = route.params;
  const [loading, setLoading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  const initials = getInitials(userName);

  const handleDone = () => {
    setLoading(true);
    // TODO: პროფილის ფოტოს ატვირთვა Firebase Storage-ში
    setTimeout(() => {
      setLoading(false);
      navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] });
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <ProgressBar step={2} total={2} />
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.title}>პროფილის დასრულება</Text>
        <Text style={styles.subtitle}>სურვილისამებრ დაამატე პროფილის ფოტო.</Text>

        <View style={styles.nameCard}>
          <Check size={16} color={colors.success} strokeWidth={2.5} />
          <Text style={styles.nameLabel}>სახელი:</Text>
          <Text style={styles.nameValue}>{userName}</Text>
        </View>

        <View style={styles.photoSection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {hasPhoto ? (
                <Text style={styles.avatarInitials}>{initials || '+'}</Text>
              ) : (
                <User size={38} color={colors.primary} />
              )}
            </View>
            <Pressable style={styles.cameraBadge} onPress={() => setHasPhoto((p) => !p)}>
              <Camera size={14} color={colors.primaryForeground} />
            </Pressable>
          </View>

          <View style={styles.photoActions}>
            <Pressable style={styles.photoActionButton} onPress={() => setHasPhoto(true)}>
              <Camera size={14} color={colors.mutedForeground} />
              <Text style={styles.photoActionText}>ფოტოს გადაღება</Text>
            </Pressable>
            <Pressable style={styles.photoActionButton} onPress={() => setHasPhoto(true)}>
              <User size={14} color={colors.mutedForeground} />
              <Text style={styles.photoActionText}>გალერეიდან</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="დასრულება"
          loadingLabel="შენახვა..."
          onPress={handleDone}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  nameLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  nameValue: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  photoSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoActionText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
