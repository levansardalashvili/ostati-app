import React, { useRef, useState } from 'react';
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
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerEditProfile'>;

// CustomerEditProfile — ზუსტად ზიპის App.tsx-ის CustomerEditProfile-ის
// მიხედვით. პირველი შენახვა შეგნებულად ვარდება (საცდელი error-state
// დემონსტრირებისთვის), მეორე ცდაზე წარმატებული. წარმატებულ შენახვაზე
// მონაცემები რეალურად იწერება CustomerProfileContext-ში (მანამდე
// უბრალოდ იკარგებოდა navigation.goBack()-ზე).
export function CustomerEditProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useCustomerProfile();
  const [name, setName] = useState(`${profile.firstName} ${profile.lastName}`.trim());
  const [address, setAddress] = useState(profile.defaultAddress);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const attemptRef = useRef(0);

  const nameErr = !name.trim() ? 'ეს ველი სავალდებულოა' : '';

  const handleSave = () => {
    if (!name.trim() || isSaving) return;
    setSaveError(false);
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      if (attemptRef.current === 0) {
        setSaveError(true);
        attemptRef.current += 1;
      } else {
        const [firstName, ...lastNameParts] = name.trim().split(' ');
        setProfile({ firstName, lastName: lastNameParts.join(' '), defaultAddress: address.trim() });
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
            <Avatar initials={`${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`} color={colors.primary} size={88} />
            <Pressable style={styles.cameraBadge}>
              <Camera size={14} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <TextField label="სახელი და გვარი" value={name} onChangeText={setName} error={nameErr} />
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
        <Button label="ცვლილებების შენახვა" onPress={handleSave} disabled={!name.trim()} loading={isSaving} loadingLabel="ინახება..." />
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
