import React, { createContext, useContext, useState } from 'react';

// CustomerProfileContext — Customer-ის საკუთარი პროფილის მონაცემები
// (რეგისტრაციისას/Google-ით შევსებული), გაზიარებული ეკრანებს შორის:
// Register/GoogleComplete წერენ საწყის მნიშვნელობებს, CustomerHome/
// CustomerProfile/CustomerEditProfile კითხულობენ და ცვლიან, PostJob
// მხოლოდ კითხულობს defaultAddress-ს (საწყისი მნიშვნელობისთვის, მაგრამ
// მასში ცვლილება default address-ს არასდროს არ სცვლის).
// TODO: ჩანაცვლდება Firestore-ის users/{uid} დოკუმენტით.
export type CustomerProfileState = {
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
};

const DEFAULT_PROFILE: CustomerProfileState = {
  firstName: 'ნინო',
  lastName: 'სულაბერიძე',
  email: 'nino.sulaberidze@gmail.com',
  defaultAddress: 'ვაკე, თბილისი',
};

type CustomerProfileContextValue = {
  profile: CustomerProfileState;
  setProfile: (patch: Partial<CustomerProfileState>) => void;
};

const CustomerProfileContext = createContext<CustomerProfileContextValue | null>(null);

export function CustomerProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<CustomerProfileState>(DEFAULT_PROFILE);

  const setProfile = (patch: Partial<CustomerProfileState>) => {
    setProfileState((prev) => ({ ...prev, ...patch }));
  };

  return <CustomerProfileContext.Provider value={{ profile, setProfile }}>{children}</CustomerProfileContext.Provider>;
}

export function useCustomerProfile() {
  const ctx = useContext(CustomerProfileContext);
  if (!ctx) throw new Error('useCustomerProfile must be used within CustomerProfileProvider');
  return ctx;
}
