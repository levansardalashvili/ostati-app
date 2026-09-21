import { supabase } from './supabaseClient';

// ჩატში მომხმარებლის დაბლოკვა/დარეპორტება (supabase/migrations/0095). წერა მხოლოდ RPC-ით.
export type ChatReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'scam' | 'other';

export const blockService = {
  // მე დავბლოკე თუ არა ეს მომხმარებელი (user_blocks — მხოლოდ საკუთარი ჩანაწერები იკითხება)
  async isBlockedByMe(otherUserId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocked_id', otherUserId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async block(otherUserId: string): Promise<void> {
    const { error } = await supabase.rpc('block_user', { p_user_id: otherUserId });
    if (error) throw error;
  },
  async unblock(otherUserId: string): Promise<void> {
    const { error } = await supabase.rpc('unblock_user', { p_user_id: otherUserId });
    if (error) throw error;
  },
  async reportUser(otherUserId: string, reason: ChatReportReason, details?: string): Promise<void> {
    const { error } = await supabase.rpc('report_chat_user', {
      p_user_id: otherUserId,
      p_reason: reason,
      p_details: details ?? null,
    });
    if (error) throw error;
  },
};
