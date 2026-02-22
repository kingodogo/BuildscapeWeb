
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
         const { id: userId } = user;
         
         // 1. Get the current user's linked Minecraft UUID
         const { data: profile } = await supabaseAdmin
             .from('profiles')
             .select('minecraft_uuid')
             .eq('id', userId)
             .single();
             
         const mUuid = profile?.minecraft_uuid;
         
         // 2. Query rewards tied to either the user ID OR the linked Minecraft UUID
         const query = supabaseAdmin
             .from('user_rewards')
             .select('*');
             
         if (mUuid) {
             query.or(`user_id.eq.${userId},minecraft_uuid.eq.${mUuid}`);
         } else {
             query.eq('user_id', userId);
         }
         
         const { data, error } = await query.order('granted_at', { ascending: false });

         if (error) throw error;
         
         const now = Date.now();
         const active = (data || [])
             .filter((r: any) => !r.expires_at || r.expires_at > now)
             .map((r: any) => ({
                 id: r.id,
                 userId: r.user_id,
                 minecraftUuid: r.minecraft_uuid,
                 source: r.source,
                 sourceId: r.source_id,
                 rewards: r.rewards,
                 grantedAt: r.granted_at,
                 expiresAt: r.expires_at,
                 downloaded: r.downloaded,
                 downloadUrl: r.download_url,
                 downloadExpiresAt: r.download_expires_at
             }));

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
