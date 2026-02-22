
import { corsResponse, verifyAuthToken } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  // Redeem: Authenticated user redeeming code via Web?
  // api/redeem.ts handles "Minecraft mod" redemption (with UUID).
  // "netlify/functions/redeem.ts" handles "Web" redemption?
  // Spec says both exist.
  // api-redeem.ts created for mod.
  // This one is for Web UI.

  const { user, error: authError } = await verifyAuthToken(event);
  if (authError || !user) return corsResponse(401, { error: 'Unauthorized' });

  if (event.httpMethod !== 'POST') return corsResponse(405, { error: 'Method not allowed' });

  try {
     let body: any = {};
     try { body = JSON.parse(event.body || '{}'); } catch(e) {}
     const { code } = body;
     if (!code) return corsResponse(400, { error: 'Code required' });

     // 1. Get Code
     const { data: redeemCode, error: cErr } = await supabaseAdmin
         .from('redeem_codes')
         .select('*')
         .eq('code', code.toUpperCase().trim())
         .eq('enabled', true)
         .single();
     if (cErr || !redeemCode) return corsResponse(404, { error: 'Invalid code' });

     // 2. Checks
     if (redeemCode.expires_at && redeemCode.expires_at < Date.now()) return corsResponse(400, { error: 'Expired' });
     if (redeemCode.max_uses && redeemCode.used_count >= redeemCode.max_uses) return corsResponse(400, { error: 'Max uses reached' });

     // 3. Check already used
     // Need Minecraft UUID to check properly? Or just User ID?
     // Code redemptions track both usually.
     // Get Profile to get MC UUID
     const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
     if (!profile) return corsResponse(404, { error: 'Profile not found' });
     
     // Require MC link?
     if (!profile.minecraft_uuid) return corsResponse(400, { error: 'Link Minecraft account first' });

     const { data: existing } = await supabaseAdmin
         .from('code_redemptions')
         .select('id')
         .eq('code_id', redeemCode.id)
         .eq('user_id', user.id)
         .maybeSingle();
         
     if (existing) return corsResponse(400, { error: 'Already redeemed' });

     // 4. Redeeming
     await supabaseAdmin.from('code_redemptions').insert({
         id: crypto.randomUUID(),
         code_id: redeemCode.id,
         code: redeemCode.code,
         user_id: user.id,
         author_id: user.id,
         minecraft_uuid: profile.minecraft_uuid,
         rewards: redeemCode.rewards,
         redeemed_at: Date.now()
     });

     await supabaseAdmin.from('redeem_codes').update({ used_count: redeemCode.used_count + 1 }).eq('id', redeemCode.id);

     // Grant Rewards (Minecraft cosmetics)
     if (redeemCode.cosmetic_ids?.length) {
         const { data: mcUser } = await supabaseAdmin.from('minecraft_users').select('*').eq('uuid', profile.minecraft_uuid).maybeSingle();
         const current = mcUser?.unlocked_cosmetics || [];
         const newSet = new Set([...current, ...redeemCode.cosmetic_ids]);
         await supabaseAdmin.from('minecraft_users').upsert({
             uuid: profile.minecraft_uuid,
             unlocked_cosmetics: Array.from(newSet),
             updated_at: new Date().toISOString()
         });
     }
     
     // Grant User Rewards (Web stuff?)
     await supabaseAdmin.from('user_rewards').insert({
         id: crypto.randomUUID(),
         user_id: user.id,
         minecraft_uuid: profile.minecraft_uuid,
         source: 'code',
         source_id: redeemCode.id,
         rewards: redeemCode.rewards,
         granted_at: Date.now(),
         expires_at: null
     });

     return corsResponse(200, { success: true, rewards: redeemCode.rewards });

  } catch (error: any) {
    return corsResponse(500, { error: error.message });
  }
};
