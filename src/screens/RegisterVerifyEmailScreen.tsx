import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { OtpCodeInput } from '../components/OtpCodeInput';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import { useResendCooldown } from '../utils/useResendCooldown';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterVerifyEmail'>;

// Verify the sign-up code, then create the users row (profile came as route params).
export function RegisterVerifyEmailScreen({ navigation, route }: Props) {
  const { role, email, firstName, lastName, defaultAddress, entrance, apartment, doorCode, isPrivateHouse } =
    route.params;
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();
  const { secondsLeft, canResend, restart } = useResendCooldown(60);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (otp: string) => {
    if (verifying) return;
    setError('');
    setVerifying(true);
    try {
      const { uid } = await authService.verifyRegistrationOtp(email, otp);
      try {
        await userService.createUserRecord(uid, {
          role,
          firstName,
          lastName,
          email,
          defaultAddress,
          phone: '',
          entrance,
          apartment,
          doorCode,
          isPrivateHouse,
        });
      } catch {
        // ერთი ხელახალი ცდა მოკლე ქსელური შეფერხების გადასატანად
        // (RegisterScreen-ის/PhoneRegisterVerifyScreen-ის იგივე პატერნი).
        await new Promise((resolve) => setTimeout(resolve, 800));
        await userService.createUserRecord(uid, {
          role,
          firstName,
          lastName,
          email,
          defaultAddress,
          phone: '',
          entrance,
          apartment,
          doorCode,
          isPrivateHouse,
        });
      }
      if (role === 'provider') {
        setProviderProfile({ firstName, lastName });
        navigation.replace('ProviderSetup');
      } else {
        setProfile({ firstName, lastName, email, defaultAddress, entrance, apartment, doorCode, isPrivateHouse });
        navigation.replace('CustomerSetup', { userName: `${firstName} ${lastName}` });
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setCode('');
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setError('');
    setResending(true);
    try {
      await authService.resendRegistrationOtp(email);
      restart();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareForm contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <Text style={styles.title}>დაადასტურე ელ. ფოსტა</Text>
        <Text style={styles.subtitle}>კოდი გავაგზავნეთ {email}-ზე — შეიყვანე 6-ციფრიანი კოდი.</Text>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <OtpCodeInput value={code} onChangeText={setCode} onComplete={handleVerify} />

        <Button
          label="დადასტურება"
          loadingLabel="მოწმდება..."
          onPress={() => handleVerify(code)}
          disabled={code.length !== 6}
          loading={verifying}
        />

        <View style={styles.resendRow}>
          {canResend ? (
            <Pressable onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>{resending ? 'იგზავნება...' : 'კოდის ხელახლა გაგზავნა'}</Text>
            </Pressable>
          ) : (
            <Text style={styles.resendMuted}>ხელახლა გაგზავნა — {secondsLeft} წმ</Text>
          )}
        </View>
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.dangerBackground,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.destructive,
  },
  resendRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  resendLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  resendMuted: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
