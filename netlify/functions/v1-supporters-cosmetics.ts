
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  const { uuid } = event.queryStringParameters || {};
  if (!uuid) return corsResponse(400, { error: 'UUID required' });

  const normalizedUuid = uuid.replace(/-/g, '');

  try {
      // 1. Check for Admin/Owner first
      const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('minecraft_uuid', normalizedUuid)
          .single();
      
      const isAdmin = profile && (profile.role === 'admin' || profile.role === 'owner');

      // 2. Get cosmetics for this UUID
      let { data: mcUser } = await supabaseAdmin
          .from('minecraft_users')
          .select('*')
          .eq('uuid', normalizedUuid)
          .single();

      let unlockedIds = mcUser?.unlocked_cosmetics || [];
      const selected = mcUser?.selected_cosmetics || {};

      // 3. Get active rewards (non-expired)
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
                          if (!unlockedIds.includes(reward.id)) {
                              unlockedIds.push(reward.id);
                          }
                      }
                  });
              }
          });
      }

      // Admin/owner override
      if (isAdmin) {
          const { data: allCosmetics } = await supabaseAdmin.from('cosmetics').select('id');
          unlockedIds = (allCosmetics || []).map((c: any) => c.id);
      }

      // 3. Get cosmetics details
      let unlockedDetails: any[] = [];
      if (unlockedIds.length > 0) {
          const { data } = await supabaseAdmin.from('cosmetics').select('*').in('id', unlockedIds);
          unlockedDetails = data || [];
      }

      return corsResponse(200, {
          uuid: normalizedUuid,
          cosmetics: unlockedDetails,
          selected: selected
      });

  } catch (error: any) {
      console.error("Supporters Cosmetics API Error:", error);
      return corsResponse(500, { error: error.message });
  }
};
