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
  certificates: { id: number; bg: string }[];
  portfolio: { id: number; bg: string }[];
  // ამ ოსტატის კვ.მ-ის ფასი (თუ მისი სპეციალობა კვადრატულობით ითვლება —
  // src/data/specialties.ts-ის pricePerSqm). Customer-ის job detail-ზე
  // "დაინტერესებული ოსტატის" ბარათზე ჩნდება, თუ ცალკე შეთავაზებული ფასი არ არის.
  sqmPrice?: string;
  // საჯარო პროფილზე საჩვენებელი სპეციალობების სია (Provider-ის მრავალარჩევანიანი
  // სპეციალობის კონცეფცია — SpecialtyPickerField-ისავე, #8) — `category`-სგან
  // დამოუკიდებელია, რომელიც მხოლოდ ფილტრაციისთვის რჩება ერთადერთ მნიშვნელობად.
  specialties: string[];
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
    specialties: ['სანტექნიკოსი', 'გიფსოკარდონი / შიდა რემონტი'],
    certificates: [{ id: 1, bg: '#DBEAFE' }],
    portfolio: [
      { id: 1, bg: '#D1FAE5' },
      { id: 2, bg: '#FEF3C7' },
      { id: 3, bg: '#FCE7F3' },
    ],
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
    specialties: ['მღებავი'],
    certificates: [],
    portfolio: [],
    sqmPrice: '18',
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
    specialties: ['ელექტრიკოსი'],
    certificates: [],
    portfolio: [],
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
    specialties: ['ავეჯის აწყობა / რემონტი'],
    certificates: [],
    portfolio: [],
  },
];

export type FeedJob = {
  id: string;
  category: string;
  title: string;
  customer: string;
  location: string;
  date: string;
  ago: string;
  interested: number;
  urgent: boolean;
  hasPhoto: boolean;
  desc: string;
  // Customer-ის მიერ არჩეული Provider-ის id, თუ job უკვე გადაწყვეტილია.
  // CURRENT_PROVIDER_ID-ს დამთხვევისას job Feed-იდან ქრება და "მიმდინარე
  // სამუშაო" ხდება Provider Home-ზე; ნებისმიერი სხვა id-ით — უბრალოდ ქრება
  // Feed-იდან (job სხვა Provider-ისთვის დაიხურა). undefined/null — job
  // ჯერ კიდევ ღიაა ინტერესის გამოსახატად.
  assignedProviderId?: string | null;
};

export const PROVIDER_FEED: FeedJob[] = [
  {
    id: 'f1',
    category: 'plumbing',
    title: 'ონკანის გამოცვლა სამზარეულოში',
    customer: 'ნინო სულ.',
    location: 'ვაკე',
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
    date: '22 დეკ., ნებისმიერ დროს',
    ago: '2 სთ.',
    interested: 7,
    urgent: false,
    hasPhoto: false,
    desc: 'ვანის ოთახის სრული სანტექნიკური სამუშაოები, 6 კვ.მ.',
    // demo: მიმდინარე Provider-ისთვის (p1) უკვე არჩეულია — "მიმდინარე
    // სამუშაო"-დ ჩანს Provider Home-ზე, Feed-ში აღარ ჩანს.
    assignedProviderId: 'p1',
  },
  {
    id: 'f3',
    category: 'electrical',
    title: 'გათბობის სისტემა — ახალი სახლი',
    customer: 'ანა კობ.',
    location: 'გლდანი',
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
    date: 'ხვალ, 10:00–14:00',
    ago: '45 წ.',
    interested: 2,
    urgent: false,
    hasPhoto: true,
    // demo: სხვა Provider-მა აიღო — ამ Provider-ის Feed-იდან ქრება მთლიანად.
    assignedProviderId: 'p3',
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
    address: 'დიდუბე, ყაზბეგის 8',
    desc: 'სამ ოთახში განათება არ მუშაობდა.',
  },
];

// დაინტერესებული ოსტატები job-ის მიხედვით (დიზაინის რეფერენსის
// INTERESTED_PROVIDERS-ის მიხედვით). offeredPrice — ოსტატის მიერ
// "დაინტერესებისას" ხელით შეთავაზებული ფასი ამ კონკრეტულ სამუშაოზე
// (არასავალდებულო) — თუ არ არის, Customer-ის ბარათზე sqmPrice-ზე ვვარდებით,
// და თუ ისიც არ არის — გენერიკულ "ფასი ნახვის შემდეგ" ტექსტზე.
export const INTERESTED_PROVIDERS: Record<string, { provider: Provider; offeredPrice?: string }[]> = {
  j1: [{ provider: PROVIDERS[0], offeredPrice: '120' }],
  j2: [{ provider: PROVIDERS[0] }, { provider: PROVIDERS[2], offeredPrice: '650' }, { provider: PROVIDERS[3] }],
  j3: [],
};

export const PHOTO_COLORS = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3'];

export type RatingData = {
  stars: number;
  review: string;
  chips: string[];
  // დასრულებული სამუშაოს ფოტო Customer-ისგან (არასავალდებულო) — RatingScreen-ზე
  // ატვირთული, MediaItem-ის იგივე {id, bg} mock ფორმატი.
  photos?: { id: number; bg: string }[];
};

// job-ისთვის უკვე გაგზავნილი შეფასება — j3 წინასწარ შეფასებულია (ზიპის
// SUBMITTED_RATINGS-ის მიხედვით), დანარჩენებისთვის ცარიელია.
export const SUBMITTED_RATINGS: Record<string, RatingData> = {
  j3: {
    stars: 5,
    review: 'ძალიან კარგი სამუშაო! დროულად მოვიდა და პრობლემა სწრაფად მოაგვარა.',
    chips: ['დროულად მოვიდა', 'ხარისხიანი სამუშაო'],
  },
};
