
import { corsResponse, verifyAuthToken } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  // User-facing rewards list
  // Must be authenticated
  const { user, error: authError } = await verifyAuthToken(event);
  if (authError || !user) return corsResponse(401, { error: 'Unauthorized' });

  try {
     if (event.httpMethod === 'GET') {
         const { id: userId } = user; // from token verification
         // The user ID in user_rewards might be the Profile ID or whatever.
         // Assuming Profile ID.
         
         const { data, error } = await supabaseAdmin
             .from('user_rewards')
             .select('*')
             .eq('user_id', userId)
             .order('granted_at', { ascending: false });

         if (error) throw error;
         
         // Filter expired
         const now = Date.now();
         const active = (data || []).filter((r: any) => !r.expires_at || r.expires_at > now);

         return corsResponse(200, { rewards: active, total: active.length });
     }
     
     if (event.httpMethod === 'POST') {
         // Action like 'markDownloaded'
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         const { action, rewardId } = body;
         
         if (action === 'markDownloaded' && rewardId) {
             const { error } = await supabaseAdmin
                 .from('user_rewards')
                 .update({ downloaded: true })
                 .eq('id', rewardId)
                 .eq('user_id', user.id);
             
             if (error) throw error;
             return corsResponse(200, { success: true });
         }
     }

     return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    return corsResponse(500, { error: error.message });
  }
};
