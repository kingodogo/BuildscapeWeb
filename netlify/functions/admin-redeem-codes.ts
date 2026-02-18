
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
         const { data, error } = await supabaseAdmin.from('redeem_codes').select('*').order('created_at', { ascending: false });
         if (error) throw error;
         return corsResponse(200, { codes: data });
     }

     if (event.httpMethod === 'POST') {
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         
         const { code } = body;
         const { error } = await supabaseAdmin.from('redeem_codes').insert({
             ...code,
             id: code.id || crypto.randomUUID(),
             created_at_ts: Date.now(),
             created_by: 'admin' // In real app use authorized user
         });
         if (error) throw error;
         return corsResponse(200, { success: true });
     }

     if (event.httpMethod === 'DELETE') {
         const { id } = event.queryStringParameters || {};
         if (!id) return corsResponse(400, { error: 'ID required' });
         
         const { error } = await supabaseAdmin.from('redeem_codes').delete().eq('id', id);
         if (error) throw error;
         return corsResponse(200, { success: true });
     }

     if (event.httpMethod === 'PATCH') {
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         const { id, updates } = body;
         const { error } = await supabaseAdmin.from('redeem_codes').update(updates).eq('id', id);
         if (error) throw error;
         return corsResponse(200, { success: true });
     }

     return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    return corsResponse(500, { error: error.message });
  }
};
