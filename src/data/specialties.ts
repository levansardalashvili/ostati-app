// ოსტატის სპეციალობების სია (Provider Setup-ისა და Post a Job ფორმის საერთო
// წყარო — დიზაინის რეფერენსის SPECIALTIES-ის მიხედვით). pricePerSqm — ეს
// სპეციალობა ჩვეულებრივ კვადრატულ მეტრზე ითვლება (ProviderSetup/EditProfile-ს
// "ფასი კვ.მ-ზე" ველი მხოლოდ ამ სპეციალობებზე ჩნდება).
export const SPECIALTIES = [
  { id: 'plumber', label: 'სანტექნიკოსი', icon: '🔧', pricePerSqm: false },
  { id: 'electrician', label: 'ელექტრიკოსი', icon: '⚡', pricePerSqm: false },
  { id: 'painter', label: 'მღებავი', icon: '🖌️', pricePerSqm: true },
  { id: 'tile', label: 'კაფელი / მეტლახი', icon: '🧱', pricePerSqm: true },
  { id: 'flooring', label: 'იატაკი / ლამინატი / პარკეტი', icon: '🪵', pricePerSqm: true },
  { id: 'drywall', label: 'გიფსოკარდონი / შიდა რემონტი', icon: '🧰', pricePerSqm: true },
  { id: 'furniture', label: 'ავეჯის აწყობა / რემონტი', icon: '🪑', pricePerSqm: false },
  { id: 'ac', label: 'კონდიციონერის მონტაჟი / სერვისი', icon: '❄️', pricePerSqm: false },
];

export const isSqmPriced = (specialtyId: string) =>
  SPECIALTIES.find((s) => s.id === specialtyId)?.pricePerSqm ?? false;
