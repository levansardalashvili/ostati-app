import { supabase } from './supabaseClient';
import type { RatingData, Review } from '../types/review';

// `reviews` ცხრილის Postgres row shape. `customer_name` დენორმალიზებულია
// (job_posts.customer_name-ის, job_responses.provider_name-ის იგივე მიზეზით,
// #55/#56) — Review.name-ს Customer-ის სახელი სჭირდება, `users`-ის RLS კი
// მხოლოდ owner-ს კითხულობს.
type ReviewRow = {
  id: string;
  job_id: string;
  customer_id: string;
  provider_id: string;
  stars: number;
  review_text: string;
  chips: string[];
  photos: {
    id: number;
    bg: string;
    uri?: string;
  }[] | null;
  created_at: string;
};

// get_provider_reviews() RPC-ის ფორმა — მხოლოდ stars/text/date (0085)
type PublicReviewRow = { stars: number; review_text: string; created_at: string };

function fromReviewRow(row: PublicReviewRow): Review {
  return {
    stars: row.stars,
    date: new Date(row.created_at).toLocaleDateString('ka-GE'),
    text: row.review_text,
  };
}

export interface ReviewService {
  // Supabase-ის `reviews` ცხრილი (#58) — job-ის დასრულებისას Customer-ის
  // მიერ გაგზავნილი შეფასების რეალური ჩაწერა/წაკითხვა.
  submitReview(
    jobId: string,
    customerId: string,
    providerId: string,
    data: RatingData,
  ): Promise<void>;
  listRealReviewsForProvider(providerId: string): Promise<Review[]>;

  // ერთი job-ის სრული შეფასება (#71) — CustomerJobDetailScreen-ს ("შენი
  // შეფასება" სექცია) და ProviderJobDetailScreen-ს ("completed" mode-ის
  // მიღებული შეფასების ბანერი) ორივეს სჭირდება იმავე job_id-ზე მიბმული
  // ერთი `reviews`-row.
  getReviewByJobId(jobId: string): Promise<RatingData | null>;
}

export const reviewService: ReviewService = {
  async submitReview(jobId, customerId, providerId, data) {
    const { error } = await supabase.from('reviews').insert({
      job_id: jobId,
      customer_id: customerId,
      provider_id: providerId,
      stars: data.stars,
      review_text: data.review,
      chips: data.chips,
      photos: data.photos ?? null,
    });
    // 23505 = ეს job უკვე შეფასებულია (წინა ცდის პასუხი დაიკარგა) — წარმატებად ითვლება
    if (error && error.code !== '23505') throw error;
  },
  async listRealReviewsForProvider(providerId) {
    const { data, error } = await supabase.rpc('get_provider_reviews', { p_provider_id: providerId });
    if (error) throw error;
    return (data as PublicReviewRow[]).map(fromReviewRow);
  },
  async getReviewByJobId(jobId) {
    const { data, error } = await supabase.from('reviews').select('*').eq('job_id', jobId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as ReviewRow;
    return { stars: row.stars, review: row.review_text, chips: row.chips, photos: row.photos ?? undefined };
  },
};
