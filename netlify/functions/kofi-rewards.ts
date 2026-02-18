
import { corsResponse, requireAdmin } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
    // GET: List rewards (Admin or Own?)
    // Source api/kofi-rewards.ts checked query param userId.
    // If user requests their own, fine. If admin requests any, fine.
    // I'll implement Admin for now, or use RLS if moved to client.
    // But this is an Admin function based on filename? No, "kofi-rewards.ts" vs "admin-kofi-rewards".
    // Wait, spec says "netlify/functions/kofi-rewards.ts". 
    // And "netlify/functions/admin-*".
    // So "kofi-rewards.ts" might be the public/user facing part?
    // But `api/kofi-rewards.ts` had POST/PATCH which looks like Admin operations (granting rewards).
    // Let's assume it's ADMIN ONLY for creation.
    
    if (event.httpMethod === 'GET') {
        // If strictly admin:
        const { authorized, response } = await requireAdmin(event);
        if (!authorized) return response;

        const { userId } = event.queryStringParameters || {};
        let query = supabaseAdmin.from('kofi_manual_rewards').select('*').order('granted_at', { ascending: false });
        
        if (userId) {
            query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return corsResponse(200, { rewards: data });
    }

    if (event.httpMethod === 'POST') {
        const { authorized, response } = await requireAdmin(event);
        if (!authorized) return response;

        let body: any = {};
        try { body = JSON.parse(event.body || '{}'); } catch(e) {}
        
        const { reward } = body;
        if (!reward || !reward.userId) return corsResponse(400, { error: 'Invalid reward' });

        const newReward = {
            id: reward.id || crypto.randomUUID(),
            user_id: reward.userId,
            minecraft_uuid: reward.minecraftUuid,
            rewards: reward.rewards || [],
            reason: reward.reason,
            granted_by: 'admin',
            granted_at: Date.now(),
            granted: reward.granted || false
        };

        const { error } = await supabaseAdmin.from('kofi_manual_rewards').insert(newReward);
        if (error) throw error;

        return corsResponse(200, { success: true, reward: newReward });
    }

    if (event.httpMethod === 'PATCH') {
        const { authorized, response } = await requireAdmin(event);
        if (!authorized) return response;

        let body: any = {};
        try { body = JSON.parse(event.body || '{}'); } catch(e) {}
        
        const { id, updates } = body;
        if (!id) return corsResponse(400, { error: 'ID required' });

        const mappedUpdates: any = {};
        if (updates.granted !== undefined) mappedUpdates.granted = updates.granted;
        // Add other fields if needed

        const { error } = await supabaseAdmin.from('kofi_manual_rewards').update(mappedUpdates).eq('id', id);
        if (error) throw error;

        return corsResponse(200, { success: true });
    }

    return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    console.error("Kofi Rewards Error:", error);
    return corsResponse(500, { error: error.message });
  }
};
