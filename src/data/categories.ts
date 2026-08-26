// სერვისის კატეგორიები (დიზაინის რეფერენსის CATEGORIES მონაცემების მიხედვით)
export type Category = {
  id: string;
  label: string;
  icon: string;
  bg: string;
  dot: string;
};

export const CATEGORIES: Category[] = [
  { id: 'plumbing', label: 'სანტექნიკა', icon: '🔧', bg: '#EFF6FF', dot: '#2563EB' },
  { id: 'electrical', label: 'ელექტრიკა', icon: '⚡', bg: '#FEFCE8', dot: '#CA8A04' },
  { id: 'painting', label: 'მხატვრობა', icon: '🖌️', bg: '#FDF4FF', dot: '#A855F7' },
  { id: 'furniture', label: 'ავეჯი', icon: '🪑', bg: '#FFF7ED', dot: '#EA580C' },
  { id: 'ac', label: 'კონდიც.', icon: '❄️', bg: '#F0FDFA', dot: '#0D9488' },
  { id: 'repair', label: 'შეკეთება', icon: '🔨', bg: '#FFF1F2', dot: '#E11D48' },
];

// ოსტატის სპეციალობის ლეიბლი კატეგორიის id-ის მიხედვით (Customer Home-ისა და
// Job Detail-ის საერთო წყარო — დიზაინის რეფერენსის SPECIALTY მეპინგის მიხედვით)
export const SPECIALTY_LABEL: Record<string, string> = {
  plumbing: 'სანტექნიკოსი',
  electrical: 'ელექტრიკოსი',
  painting: 'მღებავი',
  furniture: 'ავეჯის სპეც.',
  ac: 'კონდ. სპეც.',
  repair: 'შეკეთება',
};
