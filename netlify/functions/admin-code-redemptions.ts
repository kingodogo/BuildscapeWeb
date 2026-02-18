
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
             .select('*')
             .order('redeemed_at', { ascending: false });
         
         if (error) throw error;
         return corsResponse(200, { redemptions: data });
     }

     return corsResponse(405, { error: 'Method not allowed' });
  } catch (error: any) {
    return corsResponse(500, { error: error.message });
  }
};
