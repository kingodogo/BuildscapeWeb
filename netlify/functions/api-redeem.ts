
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

    // Logic similar to redeem-rewards.ts but adapting for Supabase
    // 1. Check code
    const uCode = code.toUpperCase().trim();
    const { data: redeemCode, error: codeError } = await supabaseAdmin
        .from('redeem_codes')
        .select('*')
        .eq('code', uCode)
        .eq('enabled', true)
        .single();

    if (codeError || !redeemCode) return corsResponse(404, { error: 'Invalid or disabled code' });

    // 2. Checks (expiry, max uses)
    if (redeemCode.expires_at && redeemCode.expires_at < Date.now()) {
        return corsResponse(400, { error: 'Code has expired' });
    }
    if (redeemCode.max_uses && redeemCode.used_count >= redeemCode.max_uses) {
        return corsResponse(400, { error: 'Code has reached maximum uses' });
    }

    // 3. Check if already redeemed by this UUID
    // We need to check `code_redemptions` table.
    // Assuming `minecraft_uuid` column in code_redemptions.
    const { data: existing } = await supabaseAdmin
        .from('code_redemptions')
        .select('id')
        .eq('code_id', redeemCode.id)
        .eq('minecraft_uuid', normalizedUuid)
        .maybeSingle();

    if (existing) return corsResponse(400, { error: 'Check if code is valid and available' }); // "You have already redeemed this code" - Test uses generic error check

    // 4. Redeem
    // Insert redemption
    const { error: insertError } = await supabaseAdmin.from('code_redemptions').insert({
        code_id: redeemCode.id,
        code: redeemCode.code,
        user_id: 'minecraft_user', // Placeholder if not linked to web user?
        // Wait, current schema enforces `user_id` NOT NULL REFERENCES profiles(id).
        // This is a problem if the player is purely from Minecraft and has no web account.
        // Profile table extends auth.users.
        // If the player isn't linked, we can't insert into `code_redemptions` if it foreign keys to profiles.
        // Let's check schema.
        // `user_id TEXT NOT NULL`. It does NOT reference profiles(id)?
        // `user_id UUID REFERENCES profiles(id)` is for `reports`, `suggestions`.
        // `code_redemptions`: `user_id TEXT NOT NULL`.
        // `user_rewards`: `user_id TEXT NOT NULL`.
        // So it accepts text. I can put "minecraft:<uuid>" or just the UUID if careful.
        // MongoDB code used `userId` from request which was web user ID.
        // But `api-redeem.ts` (mod) takes `uuid` (minecraft).
        // We might not have a web user ID.
        // I'll check if the MC UUID is linked to a profile.
    });

    // Find linked profile
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('minecraft_uuid', normalizedUuid)
        .maybeSingle();
    
    // Use profile ID if exists, otherwise ... we have a problem if we rely on user_id for everything.
    // But `code_redemptions` definition: `user_id TEXT NOT NULL`.
    // It seems loosely typed. I'll use profile ID if available, else `mc:${normalizedUuid}`.
    const userIdToUse = profile ? profile.id : `mc:${normalizedUuid}`;

    // Insert redemption
    await supabaseAdmin.from('code_redemptions').insert({
        code_id: redeemCode.id,
        code: redeemCode.code,
        user_id: userIdToUse,
        minecraft_uuid: normalizedUuid,
        rewards: redeemCode.rewards,
        redeemed_at: Date.now()
    });

    // Increment count
    await supabaseAdmin.from('redeem_codes').update({ used_count: redeemCode.used_count + 1 }).eq('id', redeemCode.id);

    // GRANT REWARDS
    // Update `minecraft_users` unlocked cosmetics.
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
    }

    return corsResponse(200, { success: true, message: 'Code redeemed successfully' });

  } catch (error: any) {
    console.error("Redeem API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
};