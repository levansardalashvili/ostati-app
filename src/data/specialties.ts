import { CATEGORIES } from './categories';

// ოსტატის სპეციალობების სია (Provider Setup-ისა და Post a Job ფორმის საერთო
// წყარო — დიზაინის რეფერენსის SPECIALTIES-ის მიხედვით). pricePerSqm — ეს
// სპეციალობა ჩვეულებრივ კვადრატულ მეტრზე ითვლება (ProviderSetup/EditProfile-ს
// "ფასი კვ.მ-ზე" ველი მხოლოდ ამ სპეციალობებზე ჩნდება). აიქონი აღარ ინახება
// აქ ემოჯის სახით — CategoryIcon.tsx-ის getCategoryIcon() id-ალიასებით
// (plumber→plumbing და ა.შ.) იმავე ცენტრალიზებულ Lucide მაპინგს იყენებს.
// ოსტატის სპეციალობა = job-ის კატეგორია (0088) — ერთი id-სივრცე.
// pricePerSqm — ეს სპეციალობა ჩვეულებრივ კვადრატულ მეტრზე ითვლება.
const SQM_PRICED = new Set(['painting', 'tile', 'flooring', 'renovation']);
export const SPECIALTIES = CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  pricePerSqm: SQM_PRICED.has(c.id),
}));

export const isSqmPriced = (specialtyId: string) =>
  SPECIALTIES.find((s) => s.id === specialtyId)?.pricePerSqm ?? false;

// SPECIALTIES-ის id-სივრცე (ეს ფაილი) CATEGORIES-ისგან (src/data/categories.ts)
// ოდნავ განსხვავდება — ერთადერთი წყარო ამ ალიასისთვის, გაზიარებული
// CategoryIcon.tsx-ს (აიქონის ალფაიდან) და userService.ts-ს (Provider.category-ის
// derivation-ისთვის, Profile-fix pass — ადრე `row.specialty[0]?.id`-ს პირდაპირ
// წერდა `Provider.category`-ში, ალიასის გარეშე, რის გამოც SPECIALTY_LABEL-ის
// (CATEGORIES-id-სივრცის) ლუქაფი ჩავარდებოდა "plumber"-ის მსგავს
// შემთხვევებზე და ჰარდქოდილი ინგლისური id უჩნდებოდა UI-ში ლეიბლის ნაცვლად).
const SPECIALTY_ID_ALIASES: Record<string, string> = {
  plumber: 'plumbing',
  electrician: 'electrical',
  painter: 'painting',
  drywall: 'renovation',
};

// SPECIALTIES-ის id (მაგ. 'plumber') → CATEGORIES-ის შესატყვისი id (მაგ.
// 'plumbing'), თუ ცნობილია. Custom "სხვა" სპეციალობებს (მომხმარებლის
// თავისუფალი ტექსტი, არცერთ SPECIALTIES-ის ფიქსირებულ id-ს არ ემთხვევა)
// კატეგორიის ეკვივალენტი არასდროს არა აქვს — undefined-ს აბრუნებს,
// გამომძახებელი თავად წყვეტს fallback-ს (ცნობილი, დოკუმენტირებული
// შეზღუდვა, არა ამ ფუნქციის ბაგი).
export function specialtyIdToCategoryId(specialtyId: string): string | undefined {
  return SPECIALTY_ID_ALIASES[specialtyId];
}
