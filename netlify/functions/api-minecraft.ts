
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyMinecraftSession } from './lib/minecraftAuth';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  // Allow GET for "Method Not Allowed" test? No, test expects 405 for GET.
  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  try {
    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {
      return corsResponse(400, { error: 'Invalid JSON' });
    }

    const { action, uuid, accessToken } = body;

    // Common validation
    if (!action) return corsResponse(400, { error: 'Action required' });
    
    if (action === 'authenticate') {
        if (!uuid) return corsResponse(400, { error: 'UUID required' });
        if (!accessToken) return corsResponse(400, { error: 'Access token required' });

        // Normalize UUID
        const normalizedUuid = uuid.replace(/-/g, '');
        
        // Verify Session
        const session = await verifyMinecraftSession(normalizedUuid, accessToken);
        if (!session.valid) {
            return corsResponse(401, { error: session.error || 'Invalid session' });
        }

        // Session valid. Get user data.
        let { data: mcUser, error } = await supabaseAdmin
            .from('minecraft_users')
            .select('*')
            .eq('uuid', normalizedUuid)
            .single();

        if (error && error.code === 'PGRST116') {
             // Not found, create if needed or return defaults
             // Spec doesn't say "auto-create", but usually implied for new players.
             // We can insert a default record.
             const newUser = {
                 uuid: normalizedUuid,
                 unlocked_cosmetics: [],
                 selected_cosmetics: {},
                 redeemed_codes: [],
                 created_at: new Date().toISOString(),
                 updated_at: new Date().toISOString()
             };
             const { data: created, error: createError } = await supabaseAdmin
                 .from('minecraft_users')
                 .insert(newUser)
                 .select()
                 .single();
             
             if (createError) throw createError;
             mcUser = created;
        } else if (error) {
            throw error;
        }

        const userUnlockedIds = mcUser.unlocked_cosmetics || [];

        // Check if user has admin/owner role (grants all cosmetics)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('minecraft_uuid', normalizedUuid)
            .single();

        const isAdmin = profile && (profile.role === 'admin' || profile.role === 'owner');

        let finalUnlockedIds = [...userUnlockedIds];
        
        // Fetch default cosmetics (Layer 1)
        const { data: defaultCosmetics } = await supabaseAdmin
            .from('cosmetics')
            .select('id')
            .eq('is_default', true);
            
        if (defaultCosmetics) {
            defaultCosmetics.forEach((c: any) => {
                if (!finalUnlockedIds.includes(c.id)) {
                    finalUnlockedIds.push(c.id);
                }
            });
        }
        
        // Fetch active rewards (non-expired) (Layer 2)
        const now = Date.now();
        const { data: activeRewards } = await supabaseAdmin
            .from('user_rewards')
            .select('rewards')
            .eq('minecraft_uuid', normalizedUuid)
            .or(`expires_at.gt.${now},expires_at.is.null`);

        if (activeRewards) {
            activeRewards.forEach((r: any) => {
                if (Array.isArray(r.rewards)) {
                    r.rewards.forEach((reward: any) => {
                        if (reward.type === 'cosmetic' && reward.id) {
                            if (!finalUnlockedIds.includes(reward.id)) {
                                finalUnlockedIds.push(reward.id);
                            }
                        }
                    });
                }
            });
        }

        // Admin/owner gets ALL cosmetics (Layer 3)
        if (isAdmin) {
            const { data: allCosmetics } = await supabaseAdmin
                .from('cosmetics')
                .select('id');
            finalUnlockedIds = (allCosmetics || []).map((c: any) => c.id);
        }

        // Return cosmetics data in the format expected by the Java mod
        return corsResponse(200, {
            unlockedCosmetics: finalUnlockedIds, // User-specific + admin bypass
            selectedCosmetics: mcUser.selected_cosmetics || {},
            defaultCosmetics: [], // Defaults handled client-side (particle trails)
            uuid: normalizedUuid,
            username: session.username,
            isAdmin: isAdmin || false
        });
    }

    return corsResponse(400, { error: 'Invalid action' });

  } catch (error: any) {
    console.error("Minecraft API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
};