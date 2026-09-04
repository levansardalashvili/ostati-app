// ოსტატის სპეციალობების სია (Provider Setup-ისა და Post a Job ფორმის საერთო
// წყარო — დიზაინის რეფერენსის SPECIALTIES-ის მიხედვით). pricePerSqm — ეს
// სპეციალობა ჩვეულებრივ კვადრატულ მეტრზე ითვლება (ProviderSetup/EditProfile-ს
// "ფასი კვ.მ-ზე" ველი მხოლოდ ამ სპეციალობებზე ჩნდება). აიქონი აღარ ინახება
// აქ ემოჯის სახით — CategoryIcon.tsx-ის getCategoryIcon() id-ალიასებით
// (plumber→plumbing და ა.შ.) იმავე ცენტრალიზებულ Lucide მაპინგს იყენებს.
export const SPECIALTIES = [
  { id: 'plumber', label: 'სანტექნიკოსი', pricePerSqm: false },
  { id: 'electrician', label: 'ელექტრიკოსი', pricePerSqm: false },
  { id: 'painter', label: 'მღებავი', pricePerSqm: true },
  { id: 'tile', label: 'კაფელი / მეტლახი', pricePerSqm: true },
  { id: 'flooring', label: 'იატაკი / ლამინატი / პარკეტი', pricePerSqm: true },
  { id: 'drywall', label: 'გიფსოკარდონი / შიდა რემონტი', pricePerSqm: true },
  { id: 'furniture', label: 'ავეჯის აწყობა / რემონტი', pricePerSqm: false },
  { id: 'ac', label: 'კონდიციონერის მონტაჟი / სერვისი', pricePerSqm: false },
];

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
