import React, { createContext, useContext, useState } from 'react';
import { userService } from '../services/userService';
import type { ProviderProfile } from '../types/provider';

// ProviderProfileContext — Provider-ის საკუთარი პროფილის მონაცემები
// (Register/GoogleComplete წერს სახელს/გვარს, ProviderSetup წერს საწყის
// პროფილს, ProviderEditProfile კითხულობს/ცვლის). CustomerProfileContext-ის
// ანალოგიური, Provider-ისთვის — ეს პირველი ადგილია, სადაც Provider-ის
// პროფილის ველები (ფოტო, აღწერა, portfolio, სერთიფიკატი) რეალურად
// გაზიარებულია ეკრანებს შორის, არა თითო ეკრანის ცალკე ლოკალური state.
//
// რეაქტიული ასლია userService-ის (getProviderProfile/updateProviderProfile)
// გარშემო — იხ. CustomerProfileContext.tsx-ის იგივე პატერნი/შენიშვნა.
export type ProviderProfileState = ProviderProfile;

// Provider verification request eligibility gate (supabase/migrations/0035
// — request_provider_verification()). This is a UI-only guard ("show a
// useful message and guide them to complete profile" per the task) — it
// has no security role, since the RPC itself never trusts anything the
// client sends. specialty/areas are already mandatory at ProviderSetupScreen
// (#13, no skip), so in practice a Provider profile that exists at all
// already satisfies those two — the check still covers them defensively
// rather than assuming it. Deliberately does NOT require `about`/portfolio/
// certificates — those were never part of the task's minimum-data list, and
// certificates in particular are explicitly optional everywhere else in
// this app (#44).
//
// Task — the old separate "profile completeness" card (checklist chips of
// missing items) is removed entirely; `percent` here (4 equally-weighted
// checks, same ones gating the button) drives a compact percentage
// indicator on VerificationRequestCard instead.
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
  if (!checks[1]) missingLabels.push('სპეციალობა');
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
