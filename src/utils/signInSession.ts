import { authService } from '../services/authService';
import { userService } from '../services/userService';
import type { CustomerProfile } from '../types/user';
import type { ProviderProfile } from '../types/provider';

export type SignedInRoute = 'CustomerHome' | 'ProviderHome' | 'ProviderSetup';
type Result = { route: SignedInRoute } | { error: string; suspended?: boolean };

// The one place a signed-in session becomes an app session — used by Login,
// PhoneLogin and RootNavigator's cold start. No `users` row or a suspended
// account → sign out. Otherwise fill the profile Context and pick the route.
// A new UserRecord field that the Context needs is added here only.
export async function loadSignedInUser(
  uid: string,
  setCustomer: (patch: Partial<CustomerProfile>) => void,
  setProvider: (patch: Partial<ProviderProfile>) => void,
): Promise<Result> {
  const record = await userService.getUserRecord(uid);
  if (!record) {
    await authService.signOut().catch(() => {});
    return { error: 'ეს ანგარიში ჯერ არ არის დარეგისტრირებული — ჯერ დარეგისტრირდი.' };
  }
  if (record.suspended) {
    await authService.signOut().catch(() => {});
    return { error: `თქვენი ანგარიში შეჩერებულია: ${record.suspensionReason ?? 'წესების დარღვევის გამო'}`, suspended: true };
  }
  if (record.role === 'provider') {
    setProvider({ firstName: record.firstName, lastName: record.lastName });
    // null = no profile row = setup not finished. A network error (undefined) is not "no row" — keep the provider on Home then.
    const profile = await userService.getProviderProfileRecord(uid).catch(() => undefined);
    if (profile) setProvider(profile);
    return { route: profile === null ? 'ProviderSetup' : 'ProviderHome' };
  }
  const { firstName, lastName, email, defaultAddress, phone, entrance, apartment, doorCode, isPrivateHouse } = record;
  setCustomer({ firstName, lastName, email, defaultAddress, phone, entrance, apartment, doorCode, isPrivateHouse });
  return { route: 'CustomerHome' };
}
