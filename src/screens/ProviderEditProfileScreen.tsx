import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, Camera } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { InlineBanner } from '../components/InlineBanner';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTIES } from '../data/specialties';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderEditProfile'>;

// ProviderEditProfile — ზუსტად ზიპის App.tsx-ის ProviderEditProfile-ის
// მიხედვით. პირველი შენახვა შეგნებულად ვარდება (error-state
// დემონსტრირებისთვის), მეორე ცდაზე წარმატებული.
export function ProviderEditProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('გიორგი ბერიძე');
  const [specs, setSpecs] = useState<Set<string>>(() => new Set(['plumber']));
  const [years, setYears] = useState(15);
  const [about, setAbout] = useState(
    'ვარ სანტექნიკოსი 15 წლიანი გამოცდილებით. ვასრულებ ყველა სახის სანტექნიკის სამუშაოს სწრაფად და ხარისხიანად.',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const attemptRef = useRef(0);

  const nameErr = !name.trim() ? 'ეს ველი სავალდებულოა' : '';
  const specErr = specs.size === 0 ? 'აირჩიე მინიმუმ ერთი სპეციალობა' : '';
  const canSave = name.trim().length > 0 && specs.size > 0;

  const toggleSpec = (id: string) => {
    setSpecs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!canSave || isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      if (attemptRef.current === 0) {
        setSaveError(true);
        attemptRef.current += 1;
      } else {
        navigation.goBack();
      }
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="პროფილის რედაქტირება" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <Avatar initials="გბ" color={colors.primary} size={88} />
            <Pressable style={styles.cameraBadge}>
              <Camera size={14} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: spacing.lg }}>
          <TextField label="სახელი და გვარი" value={name} onChangeText={setName} error={nameErr} />

          <View>
            <Text style={styles.fieldLabel}>სპეციალობა</Text>
            <View style={styles.chipsRow}>
              {SPECIALTIES.map((s) => {
                const on = specs.has(s.id);
                return (
                  <Pressable key={s.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleSpec(s.id)}>
                    <Text style={styles.chipIcon}>{s.icon}</Text>
                    <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!!specErr && (
              <View style={styles.errorRow}>
                <AlertCircle size={11} color={colors.destructive} />
                <Text style={styles.errorText}>{specErr}</Text>
              </View>
            )}
          </View>

          <View>
            <Text style={styles.fieldLabel}>გამოცდილება (წლები)</Text>
            <View style={styles.stepperRow}>
              <Pressable style={styles.stepperButton} onPress={() => setYears((y) => Math.max(0, y - 1))}>
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{years} წ.</Text>
              <Pressable style={styles.stepperButton} onPress={() => setYears((y) => y + 1)}>
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>ჩემ შესახებ</Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="მოგვიყევი შენ შესახებ..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              style={styles.textarea}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {saveError && (
          <InlineBanner type="error" msg="ცვლილებების შენახვა ვერ მოხერხდა" action="თავიდან ცდა" onAction={handleSave} />
        )}
        <Button label="ცვლილებების შენახვა" onPress={handleSave} disabled={!canSave} loading={isSaving} loadingLabel="ინახება..." />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarWrap: {
    position: 'relative',
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
  fieldLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipLabel: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '600',
  },
  chipLabelOn: {
    color: colors.primaryForeground,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs + 2,
  },
  errorText: {
    ...typography.small,
    color: colors.destructive,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    lineHeight: 20,
  },
  stepperValue: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  textarea: {
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm + 2,
  },
});
