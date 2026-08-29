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

// Firestore-ის users/{uid} დოკუმენტის ფორმა — ანგარიშის საბაზისო
// identity + role, საერთო ორივე როლისთვის. Register/GoogleComplete
// წერს ამას რეგისტრაციისას, Login კითხულობს (რომ იცოდეს, სად გადაიყვანოს
// მომხმარებელი — CustomerHome თუ ProviderHome). Provider-ისთვის
// `defaultAddress` ცარიელია (Provider-ს საცხოვრებელი მისამართი არ სჭირდება,
// #46) — მისი დანარჩენი, უფრო დეტალური პროფილი (specialty/areas/about...)
// მომავალში providerProfiles/{uid} collection-ში იქნება, ჯერ არ არსებობს.
export type UserRecord = {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
};
