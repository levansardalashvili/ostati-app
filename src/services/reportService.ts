import { supabase } from './supabaseClient';

// Must match the job_reports reason check constraint.
export type ReportReason =
  | 'provider_no_show'
  | 'customer_no_show'
  | 'work_not_completed'
  | 'inappropriate_behavior'
  | 'incorrect_information'
  | 'other';

export const reportService = {
  // The RPC derives reporter and reported user and checks the caller is a participant.
  async submitJobReport(jobId: string, reason: ReportReason, details?: string): Promise<void> {
    const { error } = await supabase.rpc('create_job_report', {
      p_job_id: jobId,
      p_reason: reason,
      p_details: details ?? null,
    });
    if (error) throw error;
  },
};
