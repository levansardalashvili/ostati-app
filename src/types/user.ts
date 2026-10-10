
export type Role = 'customer' | 'provider';

// CustomerProfileContext state.
export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
  // '' when not registered that way (same for email)
  phone: string;
  // address details; entrance is required unless isPrivateHouse
  entrance: string;
  apartment: string;
  doorCode: string;
  isPrivateHouse: boolean;
};

// `users` row: identity + role. Providers have no address; their profile is in provider_profiles.
export type UserRecord = {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
  phone: string;
  // customers only (empty for providers)
  entrance: string;
  apartment: string;
  doorCode: string;
  isPrivateHouse: boolean;
  // set by the admin; checked on login and session restore
  suspended: boolean;
  suspensionReason: string | null;
};
