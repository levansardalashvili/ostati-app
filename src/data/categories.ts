// სერვისის კატეგორიები (მომხმარებლის მოთხოვნით განახლებული სრული სია)
export type Category = {
  id: string;
  label: string;
  icon: string;
  bg: string;
  dot: string;
};

export const CATEGORIES: Category[] = [
  { id: 'plumbing', label: 'სანტექნიკა', icon: '🔧', bg: '#EFF6FF', dot: '#2563EB' },
  { id: 'electrical', label: 'ელექტროობა', icon: '⚡', bg: '#FEFCE8', dot: '#CA8A04' },
  { id: 'painting', label: 'შეღებვა', icon: '🖌️', bg: '#FDF4FF', dot: '#A855F7' },
  { id: 'ac', label: 'კონდიციონერი', icon: '❄️', bg: '#F0FDFA', dot: '#0D9488' },
  { id: 'heating', label: 'გათბობა', icon: '🔥', bg: '#FEF2F2', dot: '#DC2626' },
  { id: 'furniture', label: 'ავეჯი', icon: '🪑', bg: '#FFF7ED', dot: '#EA580C' },
  { id: 'appliance', label: 'საყოფაცხოვრებო ტექნიკის შეკეთება', icon: '🔌', bg: '#F5F3FF', dot: '#7C3AED' },
  { id: 'tile', label: 'კაფელი / მეტლახი', icon: '🧱', bg: '#FDF2F8', dot: '#DB2777' },
  { id: 'flooring', label: 'ლამინატი / პარკეტი', icon: '🪵', bg: '#FFFBEB', dot: '#B45309' },
  { id: 'doors', label: 'კარ-ფანჯარა', icon: '🚪', bg: '#ECFEFF', dot: '#0891B2' },
  { id: 'locks', label: 'საკეტები', icon: '🔒', bg: '#F1F5F9', dot: '#475569' },
  { id: 'repair', label: 'მცირე სარემონტო სამუშაოები', icon: '🔨', bg: '#FFF1F2', dot: '#E11D48' },
  { id: 'renovation', label: 'შიდა რემონტი', icon: '🏠', bg: '#ECFDF5', dot: '#059669' },
  { id: 'cleaning', label: 'დასუფთავება', icon: '🧹', bg: '#F0F9FF', dot: '#0284C7' },
  { id: 'moving', label: 'გადაზიდვა', icon: '📦', bg: '#F7FEE7', dot: '#65A30D' },
];

// ოსტატის სპეციალობის (პროფესიის) ლეიბლი კატეგორიის id-ის მიხედვით —
// განსხვავდება CATEGORIES.label-ისგან (რომელიც სერვისის სახელია), რადგან
// ეს კონკრეტულად ოსტატის პროფესიას აღწერს (Customer Home-ისა და Job
// Detail-ის საერთო წყარო)
export const SPECIALTY_LABEL: Record<string, string> = {
  plumbing: 'სანტექნიკოსი',
  electrical: 'ელექტრიკოსი',
  painting: 'მღებავი',
  ac: 'კონდიციონერის სპეც.',
  heating: 'გათბობის სპეც.',
  furniture: 'ავეჯის სპეც.',
  appliance: 'ტექნიკის ხელოსანი',
  tile: 'მეტლახის ხელოსანი',
  flooring: 'იატაკის სპეც.',
  doors: 'კარ-ფანჯრის ხელოსანი',
  locks: 'საკეტების ხელოსანი',
  repair: 'ხელოსანი',
  renovation: 'სარემონტო ბრიგადა',
  cleaning: 'დამლაგებელი',
  moving: 'გადამზიდავი',
};
