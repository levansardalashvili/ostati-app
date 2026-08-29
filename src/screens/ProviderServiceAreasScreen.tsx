import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Button } from '../components/Button';
import { RegionAreaAccordion } from '../components/RegionAreaAccordion';
import { colors, spacing, typography } from '../theme';
import { GEORGIA_REGIONS } from '../data/georgiaRegions';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderServiceAreas'>;

// ProviderServiceAreas — "სამუშაო არეალი" პროფილის მენიუდან. იგივე
// მხარეების/რაიონების accordion, რაც რეგისტრაციის RegionAreaPicker-ში
// (RegionAreaAccordion კომპონენტი გაზიარებულია ორივეს შორის).
//
// #85: მანამდე ეს ეკრანი მთლიანად ლოკალური/fake იყო — `selected`-ის
// საწყისი მნიშვნელობა ყოველთვის ჰარდქოდილი ['ვაკე','საბურთალო','ვერა']-ს
// უდრიდა (Provider-ის რეალურ, უკვე შენახულ areas-ს არასდროს კითხულობდა),
// და `handleSave` არაფერს არ წერდა Supabase-ში — მხოლოდ fake "შენახულია!"
// ტექსტს აჩვენებდა 700ms-ით და უკან ბრუნდებოდა, ცვლილება სამუდამოდ
// იკარგებოდა. ეს იყო ცნობილი, დოკუმენტირებული ხარვეზი (#31-ის შენიშვნა
// "ორივე ლოკალური state-ია") — ახლა `ProviderProfileContext`-იდან
// იტვირთება (ის უკვე რეალურია, #53/#60) და `userService.upsertProviderProfileRecord`-ით
// რეალურად ინახება, ზუსტად `ProviderEditProfileScreen`-ის areas-ველის
// იგივე save-გზით.
export function ProviderServiceAreasScreen({ navigation }: Props) {
  const { profile, setProfile } = useProviderProfile();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(profile.areas));
  const [saving, setSaving] = useState(false);

  const toggleDistrict = (district: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(district) ? next.delete(district) : next.add(district);
      return next;
    });
  };

  const toggleAllInRegion = (regionId: string) => {
    const region = GEORGIA_REGIONS.find((r) => r.id === regionId);
    if (!region) return;
    const allSelected = region.districts.every((d) => selected.has(d));
    setSelected((prev) => {
      const next = new Set(prev);
      region.districts.forEach((d) => (allSelected ? next.delete(d) : next.add(d)));
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    const areas = Array.from(selected);
    try {
      const uid = authService.getCurrentUser()?.uid;
      if (uid) {
        await userService.upsertProviderProfileRecord(uid, { ...profile, areas });
      }
      setProfile({ areas });
      navigation.goBack();
    } catch {
      Alert.alert('ვერ მოხერხდა', 'სამუშაო არეალის შენახვა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="სამუშაო არეალი" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.intro}>აირჩიე არეალები, სადაც სამუშაოს შესრულება შეგიძლია.</Text>
        <RegionAreaAccordion selected={selected} onToggleDistrict={toggleDistrict} onToggleAllInRegion={toggleAllInRegion} />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          {selected.size > 0 ? `${selected.size} არეალი შერჩეულია` : 'არეალი არ არის შერჩეული'}
        </Text>
        <Button
          label="შენახვა"
          loadingLabel="ინახება..."
          onPress={handleSave}
          disabled={selected.size === 0}
          loading={saving}
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  intro: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: 20,
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
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  footerNote: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
