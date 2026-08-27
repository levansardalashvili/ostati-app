// TODO: ჩანაცვლდება Firestore-დან წამოღებული რეალური მონაცემებით.
// ჯერჯერობით — დიზაინის რეფერენსის mock მონაცემების ზუსტი ასლი
// (product-spec.md-ის B1/C1/C3 ეკრანების დემონსტრირებისთვის).

export type Provider = {
  id: string;
  name: string;
  category: string;
  years: number;
  rating: number;
  reviews: number;
  location: string;
  areas: string[];
  price: string;
  jobs: number;
  verified: boolean;
  online: boolean;
  initials: string;
  color: string;
  bio: string;
  skills: string[];
};

export const PROVIDERS: Provider[] = [
  {
    id: 'p1',
    name: 'გიორგი ბერიძე',
    category: 'plumbing',
    years: 15,
    rating: 4.9,
    reviews: 127,
    location: 'ვაკე, თბილისი',
    areas: ['ვაკე', 'საბურთალო', 'ვერა'],
    price: '50–120₾/სთ',
    jobs: 312,
    verified: true,
    online: true,
    initials: 'გბ',
    color: '#2563EB',
    bio: 'ვარ სანტექნიკოსი 15 წლიანი გამოცდილებით. ვასრულებ როგორც მცირე სარემონტო სამუშაოებს, ასევე სრულ სანტექნიკურ მომსახურებას. სწრაფი, ხარისხიანი და სანდო.',
    skills: ['სანტექნიკის შეკეთება', 'ონკანის მონტაჟი', 'მილების შეკეთება', 'წყლის სისტემა', 'გათბობა'],
  },
  {
    id: 'p2',
    name: 'ნინო კვარაცხელია',
    category: 'painting',
    years: 8,
    rating: 4.8,
    reviews: 89,
    location: 'საბურთალო, თბილისი',
    areas: ['საბურთალო', 'ვერა', 'მთაწმინდა'],
    price: '40–80₾/სთ',
    jobs: 201,
    verified: true,
    online: false,
    initials: 'ნკ',
    color: '#A855F7',
    bio: 'ინტერიერის და ექსტერიერის მხატვრობა ეკო-საღებავებით. 8 წლის გამოცდილება, 200+ შესრულებული პროექტი.',
    skills: ['ინტერიერის მხატვრობა', 'ექსტერიერი', 'ეკო-საღებავი', 'ტექსტურა', 'ლაქება'],
  },
  {
    id: 'p3',
    name: 'დავით ჩიქოვანი',
    category: 'electrical',
    years: 10,
    rating: 4.7,
    reviews: 156,
    location: 'დიდუბე, თბილისი',
    areas: ['დიდუბე', 'გლდანი', 'ნაძალადევი'],
    price: '60–130₾/სთ',
    jobs: 445,
    verified: true,
    online: true,
    initials: 'დჩ',
    color: '#CA8A04',
    bio: 'სერტიფიცირებული ელექტრიკოსი, 10+ წლის გამოცდილება. ვასრულებ სარეზიდენციო და კომერციულ ელ. სამუშაოებს.',
    skills: ['ელ. გაყვანილობა', 'ქსელის მოწყობა', 'განათება', 'ავტომატ. ამომრთველი', 'კონდ. გაყვანილობა'],
  },
  {
    id: 'p4',
    name: 'მარიამ გელაშვილი',
    category: 'furniture',
    years: 12,
    rating: 4.9,
    reviews: 73,
    location: 'ისანი, თბილისი',
    areas: ['ისანი', 'სამგორი', 'ავლაბარი'],
    price: '30–60₾/სთ',
    jobs: 167,
    verified: true,
    online: true,
    initials: 'მგ',
    color: '#EA580C',
    bio: 'ავეჯის შეკეთება, აწყობა და რესტავრაცია ნებისმიერი სირთულის. 12 წელი გამოცდილება, გარანტია ყველა სამუშაოზე.',
    skills: ['ავეჯის შეკეთება', 'ახალი ავეჯის აწყობა', 'რესტავრაცია', 'ლაქება', 'მეტალის სამუშაო'],
  },
];

export type FeedJob = {
  id: string;
  category: string;
  title: string;
  customer: string;
  location: string;
  budget: string | null;
  date: string;
  ago: string;
  interested: number;
  urgent: boolean;
  hasPhoto: boolean;
  desc: string;
};

export const PROVIDER_FEED: FeedJob[] = [
  {
    id: 'f1',
    category: 'plumbing',
    title: 'ონკანის გამოცვლა სამზარეულოში',
    customer: 'ნინო სულ.',
    location: 'ვაკე',
    budget: '80–120₾',
    date: 'დღეს, 16:00–18:00',
    ago: '20 წ.',
    interested: 3,
    urgent: true,
    hasPhoto: true,
    desc: 'სამზარეულოს ონკანი ძლიერ გაჟონავს. სასწრაფო შეკეთება.',
  },
  {
    id: 'f2',
    category: 'plumbing',
    title: 'სველი წერტილის სრული რემონტი',
    customer: 'გიორგი ახ.',
    location: 'საბურთალო',
    budget: '500–800₾',
    date: '22 დეკ., ნებისმიერ დროს',
    ago: '2 სთ.',
    interested: 7,
    urgent: false,
    hasPhoto: false,
    desc: 'ვანის ოთახის სრული სანტექნიკური სამუშაოები, 6 კვ.მ.',
  },
  {
    id: 'f3',
    category: 'electrical',
    title: 'გათბობის სისტემა — ახალი სახლი',
    customer: 'ანა კობ.',
    location: 'გლდანი',
    budget: '1200–1800₾',
    date: 'იანვარი, მოქნილი',
    ago: '5 სთ.',
    interested: 12,
    urgent: false,
    hasPhoto: false,
    desc: '80 კვ.მ, ახალი სახლი. სრული გათბობის სისტემის მოწყობა.',
  },
  {
    id: 'f4',
    category: 'painting',
    title: 'სამოსახლო ოთახის მოხატვა',
    customer: 'მარი ბ.',
    location: 'ვერა',
    budget: null,
    date: 'ხვალ, 10:00–14:00',
    ago: '45 წ.',
    interested: 2,
    urgent: false,
    hasPhoto: true,
    desc: '20 კვ.მ ოთახი, 2 ფერი. ეკო-საღებავი სასურველია.',
  },
];

export type CustomerJob = {
  id: string;
  title: string;
  category: string;
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  provider: string | null;
  date: string;
  budget: string;
  address: string;
  desc: string;
};

export const CUSTOMER_JOBS: CustomerJob[] = [
  {
    id: 'j1',
    title: 'სანტექნიკის შეკეთება',
    category: 'plumbing',
    status: 'active',
    provider: 'გიორგი ბერიძე',
    date: 'დღეს 16:00',
    budget: '120₾',
    address: 'ვაკე, ჭავჭავაძის 45',
    desc: 'სამზარეულოში ონკანი გაჟონავს.',
  },
  {
    id: 'j2',
    title: 'ოთახის მოხატვა',
    category: 'painting',
    status: 'pending',
    provider: null,
    date: '20 დეკ.',
    budget: '300₾',
    address: 'საბ., გამსახურდიას 12',
    desc: '25 კვ.მ ოთახი, 2 ფერი, ეკო-საღებავი.',
  },
  {
    id: 'j3',
    title: 'ელ. გაყვანილობა',
    category: 'electrical',
    status: 'completed',
    provider: 'დავით ჩიქოვანი',
    date: '5 დეკ.',
    budget: '200₾',
    address: 'დიდუბე, ყაზბეგის 8',
    desc: 'სამ ოთახში განათება არ მუშაობდა.',
  },
];

// დაინტერესებული ოსტატები job-ის მიხედვით (დიზაინის რეფერენსის
// INTERESTED_PROVIDERS-ის მიხედვით)
export const INTERESTED_PROVIDERS: Record<string, Provider[]> = {
  j1: [PROVIDERS[0]],
  j2: [PROVIDERS[0], PROVIDERS[2], PROVIDERS[3]],
  j3: [],
};

export const PHOTO_COLORS = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3'];

export type RatingData = { stars: number; review: string; chips: string[] };

// job-ისთვის უკვე გაგზავნილი შეფასება — j3 წინასწარ შეფასებულია (ზიპის
// SUBMITTED_RATINGS-ის მიხედვით), დანარჩენებისთვის ცარიელია.
export const SUBMITTED_RATINGS: Record<string, RatingData> = {
  j3: {
    stars: 5,
    review: 'ძალიან კარგი სამუშაო! დროულად მოვიდა და პრობლემა სწრაფად მოაგვარა.',
    chips: ['დროულად მოვიდა', 'ხარისხიანი სამუშაო'],
  },
};
