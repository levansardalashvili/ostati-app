import type { CompletedJob } from '../types/job';
import type { RatingData, Review } from '../types/review';
import { PROVIDER_COMPLETED_JOBS, PROVIDER_REVIEWS } from '../data/mockReviews';
import { SUBMITTED_RATINGS } from '../data/mockHomeData';

export interface ReviewService {
  getReviewsForProvider(providerId: string): Review[];
  getCompletedJobs(): CompletedJob[];
  getSubmittedRating(jobId: string): RatingData | undefined;
}

// TODO: ჩანაცვლდება Firestore-ის reviews collection-ით.
export const reviewService: ReviewService = {
  getReviewsForProvider: (providerId) => PROVIDER_REVIEWS[providerId] ?? [],
  getCompletedJobs: () => PROVIDER_COMPLETED_JOBS,
  getSubmittedRating: (jobId) => SUBMITTED_RATINGS[jobId],
};
