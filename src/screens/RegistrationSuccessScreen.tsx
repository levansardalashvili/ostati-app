import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BrandMark } from '../components/BrandMark';
import { Reveal } from '../components/Reveal';
import { colors, radius, spacing, typography } from '../theme';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import { useReduceMotion } from '../utils/motion';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RegistrationSuccess'>;

// Short welcome after setup, then continues to the right Home.
export function RegistrationSuccessScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const reduceMotion = useReduceMotion();
  const { profile: customerProfile } = useCustomerProfile();
  const { profile: providerProfile } = useProviderProfile();
  const firstName = role === 'provider' ? providerProfile.firstName : customerProfile.firstName;

  useEffect(() => {
    const timer = setTimeout(
      () => navigation.reset({ index: 0, routes: [{ name: role === 'provider' ? 'ProviderHome' : 'CustomerHome' }] }),
      reduceMotion ? 500 : 2200,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, role]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <BrandMark />
          <Reveal delay={620} from="none" scaleFrom={0.4} style={styles.badge}>
            <Check size={16} color={colors.primaryForeground} strokeWidth={3} />
          </Reveal>
        </View>
        <Reveal delay={180}>
          <Text style={styles.title}>{firstName ? `მოგესალმებით, ${firstName}!` : 'მოგესალმებით!'}</Text>
        </Reveal>
        <Reveal delay={300}>
          <Text style={styles.subtitle}>თქვენი ანგარიში მზადაა — ვხსნით ოსტატს</Text>
        </Reveal>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
