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
