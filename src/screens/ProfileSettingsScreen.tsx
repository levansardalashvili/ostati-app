import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Eye, EyeOff, Shield } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSettings'>;

// ProfileSettings — "ანგარიშის პარამეტრები" (ზუსტად ზიპის App.tsx-ის
// ProfileSettings-ის მიხედვით — მხოლოდ პაროლის შეცვლა).
export function ProfileSettingsScreen({ navigation }: Props) {
  const [pwSheetOpen, setPwSheetOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const canSave = !!oldPw && newPw.length >= 6;

  const closeSheet = () => {
    setPwSheetOpen(false);
    setOldPw('');
    setNewPw('');
    setShowOld(false);
    setShowNew(false);
  };

  const handleSave = () => {
    if (!canSave) return;
    // TODO: Supabase Auth-ის supabase.auth.updateUser({ password }) გამოძახება
    closeSheet();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ანგარიშის პარამეტრები" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.card} onPress={() => setPwSheetOpen(true)}>
          <View style={styles.cardLeft}>
            <View style={styles.iconWrap}>
              <Shield size={17} color={colors.primary} />
            </View>
            <Text style={styles.cardLabel}>პაროლის შეცვლა</Text>
          </View>
          <ChevronRight size={15} color={colors.mutedForeground} />
        </Pressable>
        <Text style={styles.footNote}>Google-ის ანგარიშით შესვლის შემთხვევაში პაროლის მართვა ხდება Google-ის მეშვეობით.</Text>
      </View>

      <BottomSheet visible={pwSheetOpen} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>პაროლის შეცვლა</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>მიმდინარე პაროლი</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={oldPw}
              onChangeText={setOldPw}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showOld}
              style={styles.input}
            />
            <Pressable onPress={() => setShowOld((v) => !v)} hitSlop={8}>
              {showOld ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
            </Pressable>
          </View>
        </View>
        <View style={[styles.field, { marginBottom: spacing.lg }]}>
          <Text style={styles.fieldLabel}>ახალი პაროლი</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showNew}
              style={styles.input}
            />
            <Pressable onPress={() => setShowNew((v) => !v)} hitSlop={8}>
              {showNew ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
            </Pressable>
          </View>
        </View>
        <Button label="შენახვა" onPress={handleSave} disabled={!canSave} />
        <Pressable style={styles.cancelLink} onPress={closeSheet}>
          <Text style={styles.cancelLinkText}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  footNote: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.sm + 2,
  },
  fieldLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.xs + 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    ...typography.caption,
    color: colors.foreground,
    flex: 1,
    paddingVertical: spacing.md,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
});
