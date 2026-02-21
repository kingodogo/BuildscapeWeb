
import { corsResponse, requireAdmin } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
     const { authorized, response } = await requireAdmin(event);
     if (!authorized) return response;

     if (event.httpMethod === 'GET') {
         const { data, error } = await supabaseAdmin
             .from('code_redemptions')
             .select('*, profiles(username)')
             .order('redeemed_at', { ascending: false });
         
         if (error) throw error;
         
         const mapped = (data || []).map((r: any) => ({
             id: r.id,
             codeId: r.code_id,
             code: r.code,
             userId: r.user_id,
             username: r.profiles?.username || 'Unknown',
             minecraftUuid: r.minecraft_uuid,
             rewards: r.rewards,
             redeemedAt: Number(r.redeemed_at)
         }));

         return corsResponse(200, { redemptions: mapped });
     }

     if (event.httpMethod === 'DELETE') {
         const { redemptionId } = event.queryStringParameters || {};
         if (!redemptionId) return corsResponse(400, { error: 'Redemption ID required' });
         
         // 1. Get redemption record
         const { data: redemption, error: getError } = await supabaseAdmin
             .from('code_redemptions')
             .select('*')
             .eq('id', redemptionId)
             .single();
             
         if (getError || !redemption) return corsResponse(404, { error: 'Redemption not found' });
         
         // 2. Decrement used_count on the code
         const { data: code } = await supabaseAdmin
             .from('redeem_codes')
             .select('used_count')
             .eq('id', redemption.code_id)
             .single();
             
         if (code) {
             await supabaseAdmin
                 .from('redeem_codes')
                 .update({ used_count: Math.max(0, (code.used_count || 1) - 1) })
                 .eq('id', redemption.code_id);
         }
         
         // 3. Remove cosmetic rewards if any
         const cosmeticsToRevoke = (redemption.rewards || [])
             .filter((r: any) => r.type === 'cosmetic' && r.cosmeticData?.itemId)
             .map((r: any) => r.cosmeticData.itemId);
             
         if (cosmeticsToRevoke.length > 0 && redemption.minecraft_uuid) {
             const { data: mcUser } = await supabaseAdmin
                 .from('minecraft_users')
                 .select('unlocked_cosmetics')
                 .eq('uuid', redemption.minecraft_uuid)
                 .single();
                 
             if (mcUser) {
                 const current = mcUser.unlocked_cosmetics || [];
                 const updated = current.filter((cid: string) => !cosmeticsToRevoke.includes(cid));
                 
                 await supabaseAdmin
                     .from('minecraft_users')
                     .update({ 
                         unlocked_cosmetics: updated,
                         updated_at: new Date().toISOString()
                     })
                     .eq('uuid', redemption.minecraft_uuid);
             }
         }
         
         // 4. Delete the record
         const { error: delError } = await supabaseAdmin
             .from('code_redemptions')
             .delete()
             .eq('id', redemptionId);
             
         if (delError) throw delError;
         return corsResponse(200, { success: true });
     }

     return corsResponse(405, { error: 'Method not allowed' });
  } catch (error: any) {
    return corsResponse(500, { error: error.message });
  }
};
