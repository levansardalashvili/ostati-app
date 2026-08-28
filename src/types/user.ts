// მომხმარებლის საერთო identity-ტიპები — Customer-ისაც და Provider-ისაც
// (როლი თავად განასხვავებს, თუ რომელ პროფილს/სერვისს იყენებს UI).

export type Role = 'customer' | 'provider';

// Customer-ის საკუთარი პროფილის მონაცემები (რეგისტრაციისას/Google-ით
// შევსებული) — CustomerProfileContext-ის state-ის ფორმა.
// TODO: ჩანაცვლდება Firestore-ის users/{uid} დოკუმენტით.
export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  defaultAddress: string;
};
