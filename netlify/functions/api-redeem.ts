
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

    const { action, uuid, accessToken, code } = body;
    if (action !== 'redeemCode') return corsResponse(400, { error: 'Invalid action' });
    if (!uuid) return corsResponse(400, { error: 'UUID required' });
    if (!accessToken) return corsResponse(400, { error: 'Access token required' });
    if (!code) return corsResponse(400, { error: 'Code required' });
    // Valid format check (Test 6)
    if (code.length < 3) return corsResponse(400, { error: 'Invalid code format' });

    const normalizedUuid = uuid.replace(/-/g, '');

    // Verify Session
    const session = await verifyMinecraftSession(normalizedUuid, accessToken);
    if (!session.valid) {
        return corsResponse(401, { error: session.error || 'Invalid session' });
    }

    // 1. Check code in database
    const uCode = code.toUpperCase().trim();
    const { data: redeemCode, error: codeError } = await supabaseAdmin
        .from('redeem_codes')
        .select('*')
        .eq('code', uCode)
        .eq('enabled', true)
        .single();

    if (codeError || !redeemCode) return corsResponse(404, { error: 'Invalid or disabled code' });

    return await handleRedemption(redeemCode, normalizedUuid, accessToken);
  } catch (error: any) {
    console.error("Redeem API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
};

async function handleRedemption(redeemCode: any, normalizedUuid: string, accessToken: string) {
  try {
    const { id, code } = redeemCode;

    // 2. Checks (expiry, max uses)
    if (redeemCode.expires_at && redeemCode.expires_at < Date.now()) {
        return corsResponse(400, { error: 'Code has expired' });
    }
    if (redeemCode.max_uses && redeemCode.used_count >= redeemCode.max_uses) {
        return corsResponse(400, { error: 'Code has reached maximum uses' });
    }

    // 3. Check if already redeemed by this UUID
    const { data: existing } = await supabaseAdmin
        .from('code_redemptions')
        .select('id')
        .eq('code_id', id)
        .eq('minecraft_uuid', normalizedUuid)
        .maybeSingle();

    if (existing) return corsResponse(400, { error: 'Check if code is valid and available' });

    // Find linked profile
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('minecraft_uuid', normalizedUuid)
        .maybeSingle();
    
    const userIdToUse = profile ? profile.id : `mc:${normalizedUuid}`;

    // 4. Redeem
    // Insert redemption
    await supabaseAdmin.from('code_redemptions').insert({
        code_id: id,
        code: code,
        user_id: userIdToUse,
        minecraft_uuid: normalizedUuid,
        rewards: redeemCode.rewards,
        redeemed_at: Date.now()
    });

    // Increment count
    await supabaseAdmin.from('redeem_codes').update({ used_count: redeemCode.used_count + 1 }).eq('id', id);

    // GRANT REWARDS
    if (redeemCode.cosmetic_ids && redeemCode.cosmetic_ids.length > 0) {
        const { data: mcUser } = await supabaseAdmin
            .from('minecraft_users')
            .select('unlocked_cosmetics')
            .eq('uuid', normalizedUuid)
            .single();
            
        const current = mcUser?.unlocked_cosmetics || [];
        const newSet = new Set([...current, ...redeemCode.cosmetic_ids]);
        
        await supabaseAdmin
            .from('minecraft_users')
            .upsert({
                uuid: normalizedUuid,
                unlocked_cosmetics: Array.from(newSet),
                updated_at: new Date().toISOString()
            });

        // 5. Also record in user_rewards (visible on website)
        const rewardId = `code-${id}-${normalizedUuid}-${Date.now()}`;
        await supabaseAdmin.from('user_rewards').insert({
            id: rewardId,
            user_id: userIdToUse,
            minecraft_uuid: normalizedUuid,
            source: 'redeem_code',
            source_id: id,
            rewards: redeemCode.cosmetic_ids.map((cid: string) => ({ type: 'cosmetic', id: cid })),
            granted_at: Date.now()
        });
    }

    return corsResponse(200, { success: true, message: 'Code redeemed successfully' });

  } catch (error: any) {
    console.error("Redeem API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
}
;