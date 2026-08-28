import React, { createContext, useContext, useState } from 'react';
import type { SpecialtyOption } from '../components/SpecialtyPickerField';
import type { MediaItem } from '../components/MediaUploadGrid';

// ProviderProfileContext — Provider-ის საკუთარი პროფილის მონაცემები
// (Register/GoogleComplete წერს სახელს/გვარს, ProviderSetup წერს საწყის
// პროფილს, ProviderEditProfile კითხულობს/ცვლის). CustomerProfileContext-ის
// ანალოგიური, Provider-ისთვის — ეს პირველი ადგილია, სადაც Provider-ის
// პროფილის ველები (ფოტო, აღწერა, portfolio, სერთიფიკატი) რეალურად
// გაზიარებულია ეკრანებს შორის, არა თითო ეკრანის ცალკე ლოკალური state.
// ProviderProfileScreen-ის "პროფილის სისრულე" ბარათი (მომხმარებლის
// მოთხოვნით) ამის საფუძველზე ითვლის %-ს — იხ. computeCompleteness ქვემოთ.
// TODO: ჩანაცვლდება Firestore-ის providerProfiles/{uid} დოკუმენტით.
export type ProviderProfileState = {
  firstName: string;
  lastName: string;
  specialty: SpecialtyOption[];
  areas: string[];
  experience: string | null;
  about: string;
  hasPhoto: boolean;
  certificates: MediaItem[];
  portfolio: MediaItem[];
  sqmPrices: Record<string, string>;
};

const DEFAULT_PROVIDER_PROFILE: ProviderProfileState = {
  firstName: 'გიორგი',
  lastName: 'ბერიძე',
  specialty: [{ id: 'plumber', label: 'სანტექნიკოსი' }],
  areas: ['ვაკე', 'საბურთალო', 'ვერა'],
  experience: '10plus',
  about: 'ვარ სანტექნიკოსი 15 წლიანი გამოცდილებით. ვასრულებ ყველა სახის სანტექნიკის სამუშაოს სწრაფად და ხარისხიანად.',
  hasPhoto: false,
  certificates: [{ id: 1, bg: '#DBEAFE' }],
  portfolio: [
    { id: 1, bg: '#D1FAE5' },
    { id: 2, bg: '#FEF3C7' },
    { id: 3, bg: '#FCE7F3' },
  ],
  sqmPrices: {},
};

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
    { key: 'photo', label: 'პროფილის ფოტო', done: p.hasPhoto, optional: false },
    { key: 'about', label: 'ჩემ შესახებ აღწერა', done: p.about.trim().length >= ABOUT_MIN_LENGTH, optional: false },
    { key: 'portfolio', label: 'ნამუშევრების ფოტო', done: p.portfolio.length > 0, optional: false },
    { key: 'certificates', label: 'სერთიფიკატი', done: p.certificates.length > 0, optional: true },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, missing: items.filter((i) => !i.done) };
}

type ProviderProfileContextValue = {
  profile: ProviderProfileState;
  setProfile: (patch: Partial<ProviderProfileState>) => void;
};

const ProviderProfileContext = createContext<ProviderProfileContextValue | null>(null);

export function ProviderProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProviderProfileState>(DEFAULT_PROVIDER_PROFILE);

  const setProfile = (patch: Partial<ProviderProfileState>) => {
    setProfileState((prev) => ({ ...prev, ...patch }));
  };

  return <ProviderProfileContext.Provider value={{ profile, setProfile }}>{children}</ProviderProfileContext.Provider>;
}

export function useProviderProfile() {
  const ctx = useContext(ProviderProfileContext);
  if (!ctx) throw new Error('useProviderProfile must be used within ProviderProfileProvider');
  return ctx;
}
