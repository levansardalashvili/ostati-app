import React, { createContext, useContext, useState } from 'react';
import { userService } from '../services/userService';
import type { ProviderProfile } from '../types/provider';

// The provider's own profile, shared by setup/edit/profile screens
// (reactive copy around userService, like CustomerProfileContext).
export type ProviderProfileState = ProviderProfile;

// UI-only check before requesting verification (the RPC re-checks).
// photo, name, profession, area — about/portfolio/certificates are optional.
// percent drives the ring on VerificationRequestCard.
export type VerificationEligibility = {
  eligible: boolean;
  missingLabels: string[];
  percent: number;
};

export function getVerificationEligibility(p: ProviderProfileState): VerificationEligibility {
  const checks = [
    !!p.firstName.trim() && !!p.lastName.trim(),
    p.specialty.length > 0,
    p.areas.length > 0,
    !!p.photoUrl,
  ];
  const missingLabels: string[] = [];
  if (!checks[0]) missingLabels.push('სახელი და გვარი');
  if (!checks[1]) missingLabels.push('პროფესია');
  if (!checks[2]) missingLabels.push('სამუშაო არეალი');
  if (!checks[3]) missingLabels.push('პროფილის ფოტო');
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return { eligible: missingLabels.length === 0, missingLabels, percent };
}

type ProviderProfileContextValue = {
  profile: ProviderProfileState;
  setProfile: (patch: Partial<ProviderProfileState>) => void;
};

const ProviderProfileContext = createContext<ProviderProfileContextValue | null>(null);

export function ProviderProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProviderProfileState>(() => userService.getProviderProfile());

  const setProfile = (patch: Partial<ProviderProfileState>) => {
    setProfileState(userService.updateProviderProfile(patch));
  };

  return <ProviderProfileContext.Provider value={{ profile, setProfile }}>{children}</ProviderProfileContext.Provider>;
}

export function useProviderProfile() {
  const ctx = useContext(ProviderProfileContext);
  if (!ctx) throw new Error('useProviderProfile must be used within ProviderProfileProvider');
  return ctx;
}
