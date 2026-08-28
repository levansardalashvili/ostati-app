import React, { createContext, useContext, useState } from 'react';
import { userService } from '../services/userService';
import type { CustomerProfile } from '../types/user';

// CustomerProfileContext — Customer-ის საკუთარი პროფილის მონაცემები
// (რეგისტრაციისას/Google-ით შევსებული), გაზიარებული ეკრანებს შორის:
// Register/GoogleComplete წერენ საწყის მნიშვნელობებს, CustomerHome/
// CustomerProfile/CustomerEditProfile კითხულობენ და ცვლიან, PostJob
// მხოლოდ კითხულობს defaultAddress-ს (საწყისი მნიშვნელობისთვის, მაგრამ
// მასში ცვლილება default address-ს არასდროს არ სცვლის).
//
// რეაქტიული ასლია userService-ის (getCustomerProfile/updateCustomerProfile)
// გარშემო — ორივე სინქრონულია, ამიტომ setState-ის timing უცვლელია
// (raw useState-ის იდენტური ქცევა), მაგრამ ახლა ერთადერთი "წყარო
// სიმართლისთვის" userService-შია, არა Context-ის საკუთარ constant-ში.
export type CustomerProfileState = CustomerProfile;

type CustomerProfileContextValue = {
  profile: CustomerProfileState;
  setProfile: (patch: Partial<CustomerProfileState>) => void;
};

const CustomerProfileContext = createContext<CustomerProfileContextValue | null>(null);

export function CustomerProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<CustomerProfileState>(() => userService.getCustomerProfile());

  const setProfile = (patch: Partial<CustomerProfileState>) => {
    setProfileState(userService.updateCustomerProfile(patch));
  };

  return <CustomerProfileContext.Provider value={{ profile, setProfile }}>{children}</CustomerProfileContext.Provider>;
}

export function useCustomerProfile() {
  const ctx = useContext(CustomerProfileContext);
  if (!ctx) throw new Error('useCustomerProfile must be used within CustomerProfileProvider');
  return ctx;
}
