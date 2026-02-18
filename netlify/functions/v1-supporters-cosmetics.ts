
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
      // Get unlocking cosmetics for this UUID
      const { data: mcUser, error } = await supabaseAdmin
          .from('minecraft_users')
          .select('*')
          .eq('uuid', normalizedUuid)
          .single();

      if (error && error.code !== 'PGRST116') throw error;

      const unlockedIds = mcUser?.unlocked_cosmetics || [];
      const selected = mcUser?.selected_cosmetics || {};

      // Get cosmetics details for unlocked + defaults
      const { data: defaults } = await supabaseAdmin.from('cosmetics').select('*').eq('is_default', true);
      
      let unlockedDetails: any[] = [];
      if (unlockedIds.length > 0) {
          const { data } = await supabaseAdmin.from('cosmetics').select('*').in('id', unlockedIds);
          unlockedDetails = data || [];
      }

      const all = [...(defaults || []), ...unlockedDetails];
      // Deduplicate
      const unique = Array.from(new Map(all.map(item => [item.id, item])).values());

      return corsResponse(200, {
          uuid: normalizedUuid,
          cosmetics: unique,
          selected: selected
      });

  } catch (error: any) {
      console.error("Supporters Cosmetics API Error:", error);
      return corsResponse(500, { error: error.message });
  }
};
