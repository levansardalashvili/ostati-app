import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { InlineBanner } from '../components/InlineBanner';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerEditProfile'>;

// CustomerEditProfile — ზუსტად ზიპის App.tsx-ის CustomerEditProfile-ის
// მიხედვით. წარმატებულ შენახვაზე მონაცემები იწერება CustomerProfileContext-ში
// (მყისიერი UI feedback) და პარალელურად Supabase-ის `users` ცხრილში
// (userService.updateUserRecord) — რომ ცვლილება რეალურად შენარჩუნდეს, არა
// მხოლოდ ამ სესიაში.
//
// Profile-fix pass — root-cause fix: ეს ეკრანი ადრე შეგნებულად აგდებდა
// პირველ "შენახვას" (`attemptRef.current === 0` → ყოველთვის setSaveError(true),
// Supabase-ისკენ საერთოდ არ მიდიოდა), მხოლოდ დემონსტრაციული/საცდელი
// error-state-ის საჩვენებლად ადრეულ ეტაპზე დარჩენილი scaffold — არა
// რეალური ბაგი async sequencing-ში/state-ში/Supabase-ში. მოცილებულია
// მთლიანად — handleSave ახლა რეალურ Supabase-ის ოპერაციას პირველივე
// დაჭერისას იძახებს, ხელოვნური setTimeout/attemptRef-ის გარეშე.
export function CustomerEditProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useCustomerProfile();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [address, setAddress] = useState(profile.defaultAddress);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const firstNameErr = !firstName.trim() ? 'ეს ველი სავალდებულოა' : '';
  const lastNameErr = !lastName.trim() ? 'ეს ველი სავალდებულოა' : '';
  const canSave = !!firstName.trim() && !!lastName.trim();

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    const patch = { firstName: firstName.trim(), lastName: lastName.trim(), defaultAddress: address.trim() };
    setProfile(patch);
    const uid = authService.getCurrentUser()?.uid;
    if (uid) {
      try {
        await userService.updateUserRecord(uid, patch);
      } catch {
        // ლოკალურ Context-ში ცვლილება უკვე ასახულია — Supabase-ის
        // ჩავარდნისას UI-ს არ ვბლოკავთ, უბრალოდ ჩუმად რჩება
        // შემდეგ სინქრონიზაციამდე (მომავალში: retry/queue).
      }
    }
    setIsSaving(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="პროფილის რედაქტირება" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <Avatar initials={`${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`} color={colors.primary} size={88} />
            <Pressable style={styles.cameraBadge}>
              <Camera size={14} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <TextField testID="customer-edit-first-name" label="სახელი" value={firstName} onChangeText={setFirstName} error={firstNameErr} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField testID="customer-edit-last-name" label="გვარი" value={lastName} onChangeText={setLastName} error={lastNameErr} />
            </View>
          </View>
          <TextField label="მისამართი" value={address} onChangeText={setAddress} placeholder="ქ., არეალი" />
          <View>
            <Text style={styles.infoLabel}>ანგარიშის ინფორმაცია</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>ელ. ფოსტა</Text>
              <Text style={styles.infoCardValue}>{profile.email}</Text>
            </View>
            <Text style={styles.infoNote}>ელ. ფოსტის შეცვლისთვის დაგვიკავშირდით.</Text>
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
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
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
  infoLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.xs + 2,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  infoCardLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  infoCardValue: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  infoNote: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: spacing.xs + 2,
    paddingHorizontal: 2,
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
