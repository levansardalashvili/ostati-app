import type { Provider } from '../data/mockHomeData';

// ახალი ოსტატის ზღვარი — 0 შეფასება. ასეთ შემთხვევაში "0.0 ★"-ის ნაცვლად
// "ახალი ოსტატი" ბეჯი უნდა ჩანდეს ყველგან, სადაც რეიტინგი ჩნდება
// (CustomerHomeScreen-ის ბარათი, ViewProviderProfileScreen, SavedProviders,
// CustomerJobDetailScreen-ის დაინტერესებული ოსტატის ბარათი).
export function isNewProvider(p: Pick<Provider, 'reviews'>): boolean {
  return p.reviews === 0;
}

const RATING_PRIOR_COUNT = 15; // "ვირტუალური" ხმების რაოდენობა baseline-ის წონისთვის
const RATING_PRIOR_MEAN = 4.3; // baseline საშუალო რეიტინგი, სანამ საკმარისი შეფასება დაგროვდება

// Bayesian/წონიანი საშუალო რეიტინგი (IMDB-ის რანჟირების პრინციპი) —
// მცირე რაოდენობის შეფასებას (მაგ. ერთი 5-ვარსკვლავიანი) არ შეუძლია
// მანიპულაციით გადააჭარბოს ასობით კარგ შეფასებას. რაც მეტი შეფასებაა,
// მით მეტად ენდობა ალგორითმი პროვაიდერის რეალურ საშუალოს baseline-ის
// ნაცვლად. გამოიყენება ყველგან, სადაც რეიტინგით დალაგება/რანჟირება
// ხდება — არასდროს პირდაპირ `p.rating`-ით (CustomerHomeScreen-ის ტოპ
// ოსტატები, CustomerJobDetailScreen-ის "რეიტინგით" sort chip).
export function weightedRating(p: Pick<Provider, 'rating' | 'reviews'>): number {
  if (p.reviews === 0) return RATING_PRIOR_MEAN;
  return (
    (p.reviews / (p.reviews + RATING_PRIOR_COUNT)) * p.rating +
    (RATING_PRIOR_COUNT / (p.reviews + RATING_PRIOR_COUNT)) * RATING_PRIOR_MEAN
  );
}

// სრული რანჟირების ქულა ("ტოპ ოსტატები") — წონიან რეიტინგს ემატება
// მცირე log-სკალირებული წონა დასრულებულ სამუშაოებზე (p.jobs) და
// მინიმალური tie-breaker ბოლო აქტივობაზე (`online`-ს ვიყენებთ პროქსად,
// mock მონაცემებს "ბოლო აქტივობის დრო" არ აქვს).
export function providerRankScore(p: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online'>): number {
  const completedJobsBoost = Math.log10(p.jobs + 1) * 0.15;
  const recentActivityBoost = p.online ? 0.05 : 0;
  return weightedRating(p) + completedJobsBoost + recentActivityBoost;
}
