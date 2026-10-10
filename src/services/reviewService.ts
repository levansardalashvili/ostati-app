import { supabase } from './supabaseClient';
import type { RatingData, Review } from '../types/review';

// Full row — read only for the job itself. Public listings go through get_provider_reviews (anonymous).
type ReviewRow = {
  id: string;
  job_id: string;
  customer_id: string;
  provider_id: string;
  stars: number;
  review_text: string;
  chips: string[];
  photos: { id: number; uri?: string }[] | null;
  created_at: string;
};

// get_provider_reviews(): no author, hidden reviews excluded
type PublicReviewRow = {
  id: string;
  stars: number;
  review_text: string;
  created_at: string;
  provider_reply: string | null;
};

function fromReviewRow(row: PublicReviewRow): Review {
  return {
    id: row.id,
    reply: row.provider_reply,
    stars: row.stars,
    date: new Date(row.created_at).toLocaleDateString('ka-GE'),
    text: row.review_text,
  };
}

export const reviewService = {
  // The insert completes the job (trigger).
  async submitReview(jobId: string, customerId: string, providerId: string, data: RatingData): Promise<void> {
    const { error } = await supabase.from('reviews').insert({
      job_id: jobId,
      customer_id: customerId,
      provider_id: providerId,
      stars: data.stars,
      review_text: data.review,
      chips: data.chips,
      photos: data.photos ?? null,
    });
    // 23505 = already rated (an earlier attempt's response was lost) → success
    if (error && error.code !== '23505') throw error;
  },
  // Provider's one-time reply.
  async replyToReview(reviewId: string, reply: string): Promise<void> {
    const { error } = await supabase.rpc('reply_to_review', { p_review_id: reviewId, p_reply: reply });
    if (error) throw error;
  },
  async listRealReviewsForProvider(providerId: string): Promise<Review[]> {
    const { data, error } = await supabase.rpc('get_provider_reviews', { p_provider_id: providerId });
    if (error) throw error;
    return (data as PublicReviewRow[]).map(fromReviewRow);
  },
  // The review for one job (both job detail screens).
  async getReviewByJobId(jobId: string): Promise<RatingData | null> {
    const { data, error } = await supabase.from('reviews').select('*').eq('job_id', jobId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as ReviewRow;
    return { stars: row.stars, review: row.review_text, chips: row.chips, photos: row.photos ?? undefined };
  },
};
