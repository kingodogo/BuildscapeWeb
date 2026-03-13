
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
        const { authorized, response } = await requireAdmin(event);
        if (!authorized) return response;

        const { userId } = event.queryStringParameters || {};
        let query = supabaseAdmin.from('kofi_manual_rewards').select('*').order('granted_at', { ascending: false });
        
        if (userId) {
            query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query;
        if (error) throw error;

        // Map snake_case to camelCase for the frontend
        const rewards = (data || []).map(r => ({
            id: r.id,
            userId: r.user_id,
            minecraftUuid: r.minecraft_uuid,
            rewards: r.rewards,
            reason: r.reason,
            grantedBy: r.granted_by,
            grantedAt: r.granted_at,
            granted: r.granted
        }));

        return corsResponse(200, { rewards });
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
            user_id: (reward.userId && reward.userId !== 'manual') ? reward.userId : null,
            minecraft_uuid: reward.minecraftUuid || null,
            rewards: reward.rewards || [],
            reason: reward.reason,
            granted_by: reward.grantedBy || 'admin',
            granted_at: Date.now(),
            granted: reward.granted || false
        };

        const { error } = await supabaseAdmin.from('kofi_manual_rewards').insert(newReward);
        if (error) {
            console.error("Failed to insert manual reward:", error);
            throw error;
        }

        // Sync to user_rewards if created as granted
        if (newReward.granted) {
            const { error: syncError } = await supabaseAdmin.from('user_rewards').upsert({
                id: `manual-${newReward.id}`,
                user_id: newReward.user_id,
                minecraft_uuid: newReward.minecraft_uuid,
                source: 'manual',
                source_id: newReward.id,
                rewards: newReward.rewards,
                granted_at: newReward.granted_at
            });
            if (syncError) console.error("Failed to sync reward to user_rewards:", syncError);
        }

        return corsResponse(200, { success: true, reward: newReward });
    }

    if (event.httpMethod === 'PATCH') {
        const { authorized, response } = await requireAdmin(event);
        if (!authorized) return response;

        let body: any = {};
        try { body = JSON.parse(event.body || '{}'); } catch(e) {}
        
        const { id, updates } = body;
        if (!id) return corsResponse(400, { error: 'ID required' });

        // Get existing to check transitions
        const { data: existing } = await supabaseAdmin.from('kofi_manual_rewards').select('*').eq('id', id).single();

        const mappedUpdates: any = {};
        if (updates.granted !== undefined) mappedUpdates.granted = updates.granted;
        if (updates.rewards !== undefined) mappedUpdates.rewards = updates.rewards;
        if (updates.reason !== undefined) mappedUpdates.reason = updates.reason;

        const { error: patchError } = await supabaseAdmin.from('kofi_manual_rewards').update(mappedUpdates).eq('id', id);
        if (patchError) {
            console.error("Failed to update manual reward:", patchError);
            throw patchError;
        }

        // Sync to user_rewards if granting
        if (updates.granted === true) {
            const finalRewards = updates.rewards || existing?.rewards || [];
            const rId = `manual-${id}`;
            const { error: syncError } = await supabaseAdmin.from('user_rewards').upsert({
                id: rId,
                user_id: (existing?.user_id && existing?.user_id !== 'manual') ? existing.user_id : null,
                minecraft_uuid: existing?.minecraft_uuid,
                source: 'manual',
                source_id: id,
                rewards: finalRewards,
                granted_at: Date.now()
            });
            if (syncError) console.error("Failed to sync reward to user_rewards:", syncError);
        } else if (updates.granted === false && existing?.granted === true) {
            // Revoke
            await supabaseAdmin.from('user_rewards').delete().eq('id', `manual-${id}`);
        }

        return corsResponse(200, { success: true });
    }

    if (event.httpMethod === 'DELETE') {
        const { authorized, response } = await requireAdmin(event);
        if (!authorized) return response;

        const { id: queryId } = event.queryStringParameters || {};
        let targetId = queryId;

        if (!targetId) {
            let body: any = {};
            try { body = JSON.parse(event.body || '{}'); } catch(e) {}
            targetId = body.id;
        }

        if (!targetId) return corsResponse(400, { error: 'ID required' });

        // 1. Delete from kofi_manual_rewards
        const { error } = await supabaseAdmin.from('kofi_manual_rewards').delete().eq('id', targetId);
        if (error) throw error;

        // 2. Also delete from user_rewards if it was granted
        await supabaseAdmin.from('user_rewards').delete().eq('id', `manual-${targetId}`);

        return corsResponse(200, { success: true });
    }

    return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    console.error("Kofi Rewards Error:", error);
    return corsResponse(500, { error: error.message });
  }
};
