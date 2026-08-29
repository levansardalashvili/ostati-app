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
  customer_name: string;
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

function fromReviewRow(row: ReviewRow): Review {
  return {
    name: row.customer_name,
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
    customerName: string,
    data: RatingData,
  ): Promise<void>;
  listRealReviewsForProvider(providerId: string): Promise<Review[]>;

  // job_id → stars, ამ Provider-ის ყველა შეფასებისთვის — ProviderCompletedJobsScreen-ს
  // (#69) სჭირდება რომელ დასრულებულ job-ს რა ვარსკვლავი დაუწერეს, `Review`-ს
  // (ზემოთ) კი `job_id` საერთოდ არ აქვს (საჯარო რევიუების სია, არა job-ზე
  // მიბმული).
  listReviewStarsByJob(providerId: string): Promise<Record<string, number>>;

  // ერთი job-ის სრული შეფასება (#71) — CustomerJobDetailScreen-ს ("შენი
  // შეფასება" სექცია) და ProviderJobDetailScreen-ს ("completed" mode-ის
  // მიღებული შეფასების ბანერი) ორივეს სჭირდება იმავე job_id-ზე მიბმული
  // ერთი `reviews`-row.
  getReviewByJobId(jobId: string): Promise<RatingData | null>;
}

export const reviewService: ReviewService = {
  async submitReview(jobId, customerId, providerId, customerName, data) {
    const { error } = await supabase.from('reviews').insert({
      job_id: jobId,
      customer_id: customerId,
      provider_id: providerId,
      customer_name: customerName,
      stars: data.stars,
      review_text: data.review,
      chips: data.chips,
      photos: data.photos ?? null,
    });
    if (error) throw error;
  },
  async listRealReviewsForProvider(providerId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ReviewRow[]).map(fromReviewRow);
  },
  async listReviewStarsByJob(providerId) {
    const { data, error } = await supabase.from('reviews').select('job_id, stars').eq('provider_id', providerId);
    if (error) throw error;
    const map: Record<string, number> = {};
    (data as { job_id: string; stars: number }[]).forEach((r) => {
      map[r.job_id] = r.stars;
    });
    return map;
  },
  async getReviewByJobId(jobId) {
    const { data, error } = await supabase.from('reviews').select('*').eq('job_id', jobId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as ReviewRow;
    return { stars: row.stars, review: row.review_text, chips: row.chips, photos: row.photos ?? undefined };
  },
};
