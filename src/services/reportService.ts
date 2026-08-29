import { supabase } from './supabaseClient';

// `job_reports` ცხრილის reason-ების fixed enum (#81, supabase/migrations/
// 0034_job_reports.sql-ის check constraint-ის ზუსტი ანარეკლი).
export type ReportReason =
  | 'provider_no_show'
  | 'customer_no_show'
  | 'work_not_completed'
  | 'inappropriate_behavior'
  | 'incorrect_information'
  | 'other';

export interface ReportService {
  // Supabase-ის `create_job_report(job_id, reason, details)` RPC-ს
  // იძახებს (#81) — `reporter_id`/`reported_user_id` არასდროს იგზავნება
  // client-იდან: RPC-ს ამ ორი პარამეტრისთვის signature-ში ადგილიც კი არ
  // აქვს, orივე სერვერზეა derived (`auth.uid()` და job-ის მეორე
  // მონაწილე). SECURITY DEFINER ფუნქცია თავად ამოწმებს, რომ caller ამ
  // job-ის რეალური მონაწილეა (Customer ან მინიჭებული Provider).
  submitJobReport(jobId: string, reason: ReportReason, details?: string): Promise<void>;
}

export const reportService: ReportService = {
  async submitJobReport(jobId, reason, details) {
    const { error } = await supabase.rpc('create_job_report', {
      p_job_id: jobId,
      p_reason: reason,
      p_details: details ?? null,
    });
    if (error) throw error;
  },
};
