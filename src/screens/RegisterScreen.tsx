import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Mail } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { Button } from '../components/Button';
import { GoogleButton } from '../components/GoogleButton';
import { ProgressBar } from '../components/ProgressBar';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// A3 — რეგისტრაცია (product-spec.md, create-account-form.md).
// მისამართის ველი customer-ისთვისაც ემატება — დიზაინის რეფერენსის
// მიხედვით, პრიორიტეტის წესის თანახმად (ზიპი კონფლიქტში იმარჯვებს).
// Provider-ისთვის მისამართი საერთოდ არ ჩანს/არ სავალდებულოა (მომხმარებლის
// მოთხოვნით) — Provider-ის სამუშაო არეალს მოგვიანებით, ProviderSetup-ზე
// ირჩევს (RegionAreaPicker), საცხოვრებელი მისამართი მას საერთოდ არ სჭირდება.
// "სახელი და გვარი" ორივე როლისთვის გაყოფილია ცალკე ველებად
// (მომხმარებლის მოთხოვნით override-ავს ზიპის ერთიან ველს).
export function RegisterScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isProvider = role === 'provider';
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const errors = {
    firstName: touched.firstName && !firstName.trim() ? 'ეს ველი სავალდებულოა' : '',
    lastName: touched.lastName && !lastName.trim() ? 'ეს ველი სავალდებულოა' : '',
    email:
      touched.email && !email
        ? 'ეს ველი სავალდებულოა'
        : touched.email && !isEmail(email)
          ? 'შეიყვანე სწორი ელ. ფოსტა'
          : '',
    address: !isProvider && touched.address && !address.trim() ? 'ეს ველი სავალდებულოა' : '',
    pass:
      touched.pass && !pass
        ? 'ეს ველი სავალდებულოა'
        : touched.pass && pass.length < 8
          ? 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'
          : '',
    confirm:
      touched.confirm && !confirm
        ? 'ეს ველი სავალდებულოა'
        : touched.confirm && confirm !== pass
          ? 'პაროლები არ ემთხვევა'
          : '',
  };

  const nameValid = !!firstName.trim() && !!lastName.trim();
  const allValid =
    nameValid && isEmail(email) && (isProvider || address.trim()) && pass.length >= 8 && pass === confirm && agreed;

  const handleSubmit = () => {
    setTouched({ firstName: true, lastName: true, email: true, address: !isProvider, pass: true, confirm: true });
    if (!allValid) return;
    setLoading(true);
    authService.registerWithEmail({ email: email.trim(), password: pass, role });
    setTimeout(() => {
      setLoading(false);
      if (role === 'provider') {
        setProviderProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
        navigation.replace('ProviderSetup');
      } else {
        setProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          defaultAddress: address.trim(),
        });
        navigation.replace('CustomerSetup', { userName: `${firstName.trim()} ${lastName.trim()}` });
      }
    }, 1200);
  };

  const handleGoogle = () => {
    setGLoading(true);
    authService.signInWithGoogle();
    setTimeout(() => {
      setGLoading(false);
      navigation.navigate('GoogleComplete', { role });
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={colors.foreground} />
            </Pressable>
            <ProgressBar step={0} total={role === 'provider' ? 3 : 2} />
            <View style={styles.backButton} />
          </View>

          <Text style={styles.title}>ანგარიშის შექმნა</Text>
          <Text style={styles.subtitle}>შეიყვანე შენი მონაცემები რეგისტრაციის გასაგრძელებლად.</Text>

          <View style={styles.fields}>
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="სახელი"
                  value={firstName}
                  onChangeText={setFirstName}
                  onBlur={() => touch('firstName')}
                  placeholder={role === 'provider' ? 'მაგ. გიორგი' : 'მაგ. ნინო'}
                  error={errors.firstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="გვარი"
                  value={lastName}
                  onChangeText={setLastName}
                  onBlur={() => touch('lastName')}
                  placeholder={role === 'provider' ? 'მაგ. ბერიძე' : 'მაგ. სულაბერიძე'}
                  error={errors.lastName}
                />
              </View>
            </View>
            <TextField
              label="ელ. ფოსტა"
              value={email}
              onChangeText={setEmail}
              onBlur={() => touch('email')}
              placeholder="example@email.com"
              error={errors.email}
              icon={Mail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {!isProvider && (
              <AddressAutocompleteField
                label="მისამართი"
                value={address}
                onChangeText={setAddress}
                onBlur={() => touch('address')}
                placeholder="მაგ. ჭავჭავაძის 48"
                error={errors.address}
              />
            )}
            <TextField
              label="პაროლი"
              value={pass}
              onChangeText={setPass}
              onBlur={() => touch('pass')}
              placeholder="••••••••"
              error={errors.pass}
              helperText={errors.pass ? undefined : 'მინიმუმ 8 სიმბოლო'}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextField
              label="გაიმეორე პაროლი"
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => touch('confirm')}
              placeholder="••••••••"
              error={errors.confirm}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.termsRow}>
              <Pressable
                style={[styles.checkbox, agreed && styles.checkboxChecked]}
                onPress={() => setAgreed((a) => !a)}
              >
                {agreed && <Check size={11} color={colors.primaryForeground} strokeWidth={3} />}
              </Pressable>
              <Text style={styles.termsText}>
                ვეთანხმები <Text style={styles.termsLink}>მომსახურების პირობებს</Text> და{' '}
                <Text style={styles.termsLink}>კონფიდენციალურობის პოლიტიკას</Text>
              </Text>
            </View>

            <Button
              label="რეგისტრაცია"
              loadingLabel="რეგისტრაცია..."
              onPress={handleSubmit}
              disabled={!allValid}
              loading={loading}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ან</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleButton loading={gLoading} onPress={handleGoogle} />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>უკვე გაქვს ანგარიში? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>შესვლა</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
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
  fields: {
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  loginText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  loginLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
});
