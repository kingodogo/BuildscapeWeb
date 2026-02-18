
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
      // Return configured tiers
      const { data: tierData, error } = await supabaseAdmin
          .from('support_tiers')
          .select('*')
          .eq('enabled', true)
          .order('level', { ascending: true });

      if (error && error.code !== 'PGRST116') throw error;

      // Fallback if empty table
      if (!tierData || tierData.length === 0) {
           return corsResponse(200, { tiers: [] });
      }

      return corsResponse(200, { tiers: tierData });

  } catch (error: any) {
      console.error("Supporters Tiers API Error:", error);
      return corsResponse(500, { error: error.message });
  }
};
