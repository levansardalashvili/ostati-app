import React, { createContext, useContext, useState } from 'react';
import { userService } from '../services/userService';
import type { ProviderProfile } from '../types/provider';

// ProviderProfileContext — Provider-ის საკუთარი პროფილის მონაცემები
// (Register/GoogleComplete წერს სახელს/გვარს, ProviderSetup წერს საწყის
// პროფილს, ProviderEditProfile კითხულობს/ცვლის). CustomerProfileContext-ის
// ანალოგიური, Provider-ისთვის — ეს პირველი ადგილია, სადაც Provider-ის
// პროფილის ველები (ფოტო, აღწერა, portfolio, სერთიფიკატი) რეალურად
// გაზიარებულია ეკრანებს შორის, არა თითო ეკრანის ცალკე ლოკალური state.
// ProviderProfileScreen-ის "პროფილის სისრულე" ბარათი (მომხმარებლის
// მოთხოვნით) ამის საფუძველზე ითვლის %-ს — იხ. computeCompleteness ქვემოთ.
//
// რეაქტიული ასლია userService-ის (getProviderProfile/updateProviderProfile)
// გარშემო — იხ. CustomerProfileContext.tsx-ის იგივე პატერნი/შენიშვნა.
export type ProviderProfileState = ProviderProfile;

const ABOUT_MIN_LENGTH = 20;

export type CompletenessItem = {
  key: 'photo' | 'about' | 'portfolio' | 'certificates';
  label: string;
  done: boolean;
  optional: boolean;
};

export type Completeness = {
  percent: number;
  missing: CompletenessItem[];
};

// 4 თანაბარწონიანი პუნქტი (25 თითო) — ზუსტად ის ველები, რაც ნდობას
// უმატებს პროფილს. სერთიფიკატი შედის ქულაში, მაგრამ არასდროს არ არის
// დაბლოკვის/შეცდომის მიზეზი არცერთ ეკრანზე (`optional: true`) —
// მომხმარებლის მოთხოვნით.
export function computeCompleteness(p: ProviderProfileState): Completeness {
  const items: CompletenessItem[] = [
    { key: 'photo', label: 'პროფილის ფოტო', done: !!p.photoUrl, optional: false },
    { key: 'about', label: 'ჩემ შესახებ აღწერა', done: p.about.trim().length >= ABOUT_MIN_LENGTH, optional: false },
    { key: 'portfolio', label: 'ნამუშევრების ფოტო', done: p.portfolio.length > 0, optional: false },
    { key: 'certificates', label: 'სერთიფიკატი', done: p.certificates.length > 0, optional: true },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, missing: items.filter((i) => !i.done) };
}

// Provider verification request eligibility gate (supabase/migrations/0035
// — request_provider_verification()). This is a UI-only guard ("show a
// useful message and guide them to complete profile" per the task) — it
// has no security role, since the RPC itself never trusts anything the
// client sends. specialty/areas are already mandatory at ProviderSetupScreen
// (#13, no skip), so in practice a Provider profile that exists at all
// already satisfies those two — the check still covers them defensively
// rather than assuming it. Deliberately does NOT require `about`/portfolio/
// certificates — those are part of the separate, broader `computeCompleteness`
// score above but were never named by the task's minimum-data list, and
// certificates in particular are explicitly optional everywhere else in
// this app (#44).
export type VerificationEligibility = {
  eligible: boolean;
  missingLabels: string[];
};

export function getVerificationEligibility(p: ProviderProfileState): VerificationEligibility {
  const missingLabels: string[] = [];
  if (!p.firstName.trim() || !p.lastName.trim()) missingLabels.push('სახელი და გვარი');
  if (p.specialty.length === 0) missingLabels.push('სპეციალობა');
  if (p.areas.length === 0) missingLabels.push('სამუშაო არეალი');
  if (!p.photoUrl) missingLabels.push('პროფილის ფოტო');
  return { eligible: missingLabels.length === 0, missingLabels };
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
