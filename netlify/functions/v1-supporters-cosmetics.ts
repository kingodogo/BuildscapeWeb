
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

      // Get cosmetics details for ONLY unlocked
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
