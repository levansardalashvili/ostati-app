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

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneRegisterVerify'>;

// Last phone sign-up step: verify the code, set the password, create the users row
// (the whole profile came as route params).
export function PhoneRegisterVerifyScreen({ navigation, route }: Props) {
  const { role, phone, firstName, lastName, defaultAddress, entrance, apartment, doorCode, isPrivateHouse, password } =
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
      const { uid } = await authService.verifyPhoneOtp(phone, otp);
      // Password lets later logins skip SMS.
      await authService.setNewPassword(password);
      try {
        await userService.createUserRecord(uid, {
          role,
          firstName,
          lastName,
          email: '',
          defaultAddress,
          phone,
          entrance,
          apartment,
          doorCode,
          isPrivateHouse,
        });
      } catch (createError) {
        // Duplicate key = this number is already registered — clear message + way to log in.
        const message = (createError as { message?: string } | null)?.message ?? '';
        if (message.includes('duplicate key')) {
          setError('ეს ნომერი უკვე დარეგისტრირებულია — სცადე "შესვლა ტელეფონით".');
          setVerifying(false);
          return;
        }
        throw createError;
      }
      if (role === 'provider') {
        setProviderProfile({ firstName, lastName });
        navigation.replace('ProviderSetup');
      } else {
        setProfile({ firstName, lastName, email: '', defaultAddress, phone, entrance, apartment, doorCode, isPrivateHouse });
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
      await authService.sendPhoneOtp(phone);
      restart();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={styles.title}>დაადასტურე ნომერი</Text>
          <Text style={styles.subtitle}>SMS გავაგზავნეთ {phone}-ზე — შეიყვანე 6-ციფრიანი კოდი.</Text>

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
