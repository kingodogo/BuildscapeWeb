
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyMinecraftSession } from './lib/minecraftAuth';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  try {
    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {
        return corsResponse(400, { error: 'Invalid JSON' });
    }

    const { action, uuid, accessToken } = body;
    if (!action) return corsResponse(400, { error: 'Action required' });
    if (!uuid) return corsResponse(400, { error: 'UUID required' });
    if (!accessToken) return corsResponse(400, { error: 'Access token required' });

    const normalizedUuid = uuid.replace(/-/g, '');

    // Verify Session for every action
    const session = await verifyMinecraftSession(normalizedUuid, accessToken);
    if (!session.valid) {
        return corsResponse(401, { error: session.error || 'Invalid session' });
    }

    // Select Cosmetic
    if (action === 'selectCosmetic') {
        const { cosmeticId, cosmeticType } = body;
        if (!cosmeticId) return corsResponse(400, { error: 'Cosmetic ID required' });
        if (!cosmeticType) return corsResponse(400, { error: 'Cosmetic Type required' });

        // Logic: Checks if user owns cosmetic, then updates selected_cosmetics
        // 1. Get user
        const { data: mcUser, error } = await supabaseAdmin
            .from('minecraft_users')
            .select('*')
            .eq('uuid', normalizedUuid)
            .single();

        if (error || !mcUser) return corsResponse(404, { error: 'User not found' });

        // 2. Check ownership (unless cosmeticId is "none" or "clear"?)
        // Assuming "none" or empty string means unequip.
        // If cosmeticId is specific, check ownership.
        
        // TODO: Is "test" a valid cosmeticId in tests?
        // Test 8: "Cosmetics - Invalid cosmetic type".
        
        let valid = false;
        if (cosmeticId === 'none' || cosmeticId === '') {
            valid = true;
        } else {
             const unlocked = mcUser.unlocked_cosmetics || [];
             if (unlocked.includes(cosmeticId)) {
                 valid = true;
             }
        }

        if (!valid) {
            return corsResponse(403, { error: 'Cosmetic not unlocked' });
        }

        // 3. Update selection
        const selected = mcUser.selected_cosmetics || {};
        if (cosmeticId === 'none' || cosmeticId === '') {
            delete selected[cosmeticType];
        } else {
            selected[cosmeticType] = cosmeticId;
        }

        const { error: updateError } = await supabaseAdmin
            .from('minecraft_users')
            .update({ selected_cosmetics: selected, updated_at: new Date().toISOString() })
            .eq('uuid', normalizedUuid);

        if (updateError) throw updateError;

        return corsResponse(200, { success: true, selected });
    }

    // Get Available Cosmetics
    if (action === 'getAvailable') {
         // Return ALL cosmetics so they can be shown as locked/unlocked
         const { data: allCosmetics } = await supabaseAdmin
             .from('cosmetics')
             .select('*');
             
         return corsResponse(200, { cosmetics: allCosmetics || [] });
    }

    return corsResponse(400, { error: 'Invalid action' });

  } catch (error: any) {
    console.error("Cosmetics API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
};