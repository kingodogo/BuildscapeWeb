
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
         const { data, error } = await supabaseAdmin.from('cosmetics').select('*').order('display_name', { ascending: true });
         if (error) throw error;
         return corsResponse(200, { cosmetics: data });
     }

     if (event.httpMethod === 'POST') {
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         const { cosmetic } = body;
         // cosmetic might need mapping if camelCase sent
         const newCosmetic = {
             id: cosmetic.id || crypto.randomUUID(),
             type: cosmetic.type,
             display_name: cosmetic.displayName || cosmetic.display_name,
             description: cosmetic.description,
             is_default: cosmetic.isDefault || cosmetic.is_default,
             is_code_based: cosmetic.isCodeBased || cosmetic.is_code_based,
             is_admin_granted: cosmetic.isAdminGranted || cosmetic.is_admin_granted,
             created_at: Date.now(),
             updated_at: Date.now()
         };
         
         const { error } = await supabaseAdmin.from('cosmetics').insert(newCosmetic);
         if (error) throw error;
         return corsResponse(200, { success: true });
     }

     if (event.httpMethod === 'DELETE') {
         const { id } = event.queryStringParameters || {};
         const { error } = await supabaseAdmin.from('cosmetics').delete().eq('id', id);
         if (error) throw error;
         return corsResponse(200, { success: true });
     }

     // PATCH omitted for brevity but should exist in real CRUD.
     
     return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    return corsResponse(500, { error: error.message });
  }
};
