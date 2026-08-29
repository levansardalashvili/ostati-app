// მომხმარებლის საერთო identity-ტიპები — Customer-ისაც და Provider-ისაც
// (როლი თავად განასხვავებს, თუ რომელ პროფილს/სერვისს იყენებს UI).

export type Role = 'customer' | 'provider';

// Customer-ის საკუთარი პროფილის მონაცემები (რეგისტრაციისას/Google-ით
// შევსებული) — CustomerProfileContext-ის state-ის ფორმა.
export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
};

// Supabase-ის `users` ცხრილის row-ის ფორმა — ანგარიშის საბაზისო
// identity + role, საერთო ორივე როლისთვის (#51/#52). Register/GoogleComplete
// წერს ამას რეგისტრაციისას, Login/RootNavigator-ის session-restore
// კითხულობს (რომ იცოდეს, სად გადაიყვანოს მომხმარებელი — CustomerHome თუ
// ProviderHome). Provider-ისთვის `defaultAddress` ცარიელია (Provider-ს
// საცხოვრებელი მისამართი არ სჭირდება, #46) — მისი დანარჩენი, უფრო
// დეტალური პროფილი (specialty/areas/about...) ცალკე `provider_profiles`
// ცხრილშია (#53, `src/types/provider.ts`-ის `ProviderProfile`).
export type UserRecord = {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
};
