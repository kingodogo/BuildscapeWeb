
import { corsResponse, requireAdmin } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
     const { authorized, response, profile: adminProfile } = await requireAdmin(event);
     if (!authorized) return response;

     // Action: Grant a reward
     if (event.httpMethod === 'POST') {
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         
         const { userId, minecraftUuid, cosmeticId, expiresAt, reason } = body;
         
         if (!userId && !minecraftUuid) {
             return corsResponse(400, { error: "Requires either userId or minecraftUuid" });
         }
         
         if (!cosmeticId) {
             return corsResponse(400, { error: "Cosmetic ID required" });
         }

         const rewardId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
         
         const newReward = {
             id: rewardId,
             user_id: (userId && userId !== 'manual') ? userId : null,
             minecraft_uuid: minecraftUuid || null,
             source: 'admin_grant',
             source_id: adminProfile.username,
             rewards: [{ type: 'cosmetic', id: cosmeticId }],
             granted_at: Date.now(),
             expires_at: expiresAt || null, // BIGINT timestamp
             downloaded: false
         };

         const { error } = await supabaseAdmin.from('user_rewards').insert(newReward);
         if (error) {
             console.error("Failed to insert admin reward:", error);
             throw error;
         }

         return corsResponse(200, { 
             success: true, 
             rewardId,
             message: `Successfully granted cosmetic ${cosmeticId} to ${minecraftUuid || userId}` 
         });
     }

     // Action: Fetch all rewards (for manual tracking)
     if (event.httpMethod === 'GET') {
         const { data, error } = await supabaseAdmin
            .from('user_rewards')
            .select('*')
            .order('granted_at', { ascending: false });
            
         if (error) throw error;
         return corsResponse(200, { rewards: data });
     }

     // Action: Delete/Revoke a reward
     if (event.httpMethod === 'DELETE') {
         const { id } = event.queryStringParameters || {};
         if (!id) return corsResponse(400, { error: "Reward ID required" });
         
         const { error } = await supabaseAdmin.from('user_rewards').delete().eq('id', id);
         if (error) throw error;
         
         return corsResponse(200, { success: true });
     }

     return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    console.error("Admin Rewards Error:", error);
    return corsResponse(500, { error: error.message });
  }
};
