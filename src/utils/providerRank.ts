import type { Provider } from '../types/provider';

// ახალი ოსტატის ზღვარი — 0 შეფასება. ასეთ შემთხვევაში "0.0 ★"-ის ნაცვლად
// "ახალი ოსტატი" ბეჯი უნდა ჩანდეს ყველგან, სადაც რეიტინგი ჩნდება
// (CustomerHomeScreen-ის ბარათი, ViewProviderProfileScreen, SavedProviders,
// CustomerJobDetailScreen-ის დაინტერესებული ოსტატის ბარათი).
export function isNewProvider(p: Pick<Provider, 'reviews'>): boolean {
  return p.reviews === 0;
}

// პარამეტრები ადმინიდან იცვლება (app_settings, 0125) და აპის გაშვებისას ჩაიტვირთება (rankingConfigService);
// ნაგულისხმევი მნიშვნელობები = ძველი ჰარდქოდი, ქსელის გარეშეც იგივე ქცევაა.
const rankingConfig = {
  priorCount: 15, // "ვირტუალური" ხმების რაოდენობა baseline-ის წონისთვის
  priorMean: 4.3, // baseline საშუალო რეიტინგი, სანამ საკმარისი შეფასება დაგროვდება
  jobsWeight: 0.15, // დასრულებული სამუშაოების log-წონა ქულაში
};

export function setRankingConfig(c: { priorCount?: number; priorMean?: number; jobsWeight?: number }) {
  if (typeof c.priorCount === 'number' && c.priorCount > 0) rankingConfig.priorCount = c.priorCount;
  if (typeof c.priorMean === 'number' && c.priorMean > 0) rankingConfig.priorMean = c.priorMean;
  if (typeof c.jobsWeight === 'number' && c.jobsWeight > 0) rankingConfig.jobsWeight = c.jobsWeight;
}

// Bayesian/წონიანი საშუალო რეიტინგი (IMDB-ის რანჟირების პრინციპი) —
// მცირე რაოდენობის შეფასებას (მაგ. ერთი 5-ვარსკვლავიანი) არ შეუძლია
// მანიპულაციით გადააჭარბოს ასობით კარგ შეფასებას. რაც მეტი შეფასებაა,
// მით მეტად ენდობა ალგორითმი პროვაიდერის რეალურ საშუალოს baseline-ის
// ნაცვლად. გამოიყენება ყველგან, სადაც რეიტინგით დალაგება/რანჟირება
// ხდება — არასდროს პირდაპირ `p.rating`-ით (CustomerHomeScreen-ის ტოპ
// ოსტატები, CustomerJobDetailScreen-ის "რეიტინგით" sort chip).
export function weightedRating(p: Pick<Provider, 'rating' | 'reviews'>): number {
  const { priorCount, priorMean } = rankingConfig;
  if (p.reviews === 0) return priorMean;
  return (p.reviews / (p.reviews + priorCount)) * p.rating + (priorCount / (p.reviews + priorCount)) * priorMean;
}

// სრული რანჟირების ქულა ("ტოპ ოსტატები") — წონიან რეიტინგს ემატება
// მცირე log-სკალირებული წონა დასრულებულ სამუშაოებზე (p.jobs) და
// მინიმალური tie-breaker ბოლო აქტივობაზე (`online`-ს ვიყენებთ პროქსად,
// mock მონაცემებს "ბოლო აქტივობის დრო" არ აქვს).
export function providerRankScore(p: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online'>): number {
  const completedJobsBoost = Math.log10(p.jobs + 1) * rankingConfig.jobsWeight;
  const recentActivityBoost = p.online ? 0.05 : 0;
  return weightedRating(p) + completedJobsBoost + recentActivityBoost;
}

// Directory order: verified Providers always first (only they can send a
// price offer, 0084), then by rank score. Use for every Provider list sort.
export function compareProviders(
  a: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online' | 'verified'>,
  b: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online' | 'verified'>,
): number {
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  return providerRankScore(b) - providerRankScore(a);
}
