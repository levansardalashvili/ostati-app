import type { Provider } from '../types/provider';

// No reviews yet → show "ახალი ოსტატი" instead of "0.0 ★".
export function isNewProvider(p: Pick<Provider, 'reviews'>): boolean {
  return p.reviews === 0;
}

// Set from the admin panel (app_settings), loaded at startup; defaults apply offline.
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

// Bayesian average: a few 5★ reviews can't beat hundreds of good ones.
// Always sort by this, never by raw rating.
export function weightedRating(p: Pick<Provider, 'rating' | 'reviews'>): number {
  const { priorCount, priorMean } = rankingConfig;
  if (p.reviews === 0) return priorMean;
  return (p.reviews / (p.reviews + priorCount)) * p.rating + (priorCount / (p.reviews + priorCount)) * priorMean;
}

// Top-providers score: weighted rating + small log weight for completed jobs + availability tie-breaker.
export function providerRankScore(p: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online'>): number {
  const completedJobsBoost = Math.log10(p.jobs + 1) * rankingConfig.jobsWeight;
  const recentActivityBoost = p.online ? 0.05 : 0;
  return weightedRating(p) + completedJobsBoost + recentActivityBoost;
}

// Verified first (only they can offer a price), then by score. Use for every provider list.
export function compareProviders(
  a: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online' | 'verified'>,
  b: Pick<Provider, 'rating' | 'reviews' | 'jobs' | 'online' | 'verified'>,
): number {
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  return providerRankScore(b) - providerRankScore(a);
}
