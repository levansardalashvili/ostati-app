import React, { createContext, useContext, useState } from 'react';
import { userService } from '../services/userService';
import type { CustomerProfile } from '../types/user';

// The customer's own profile, shared across screens. Reactive copy around userService.
// PostJob only prefills from defaultAddress and never writes it back.
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
