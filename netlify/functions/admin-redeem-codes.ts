import { corsResponse, requireAdmin } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

// Helper to map DB row to Frontend type
function mapFromDb(db: any) {
    return {
        id: db.id,
        code: db.code,
        rewards: db.rewards || [],
        description: db.description,
        maxUses: db.max_uses,
        usedCount: db.used_count || 0,
        expiresAt: db.expires_at ? Number(db.expires_at) : undefined,
        requiresMembership: db.requires_membership,
        createdAt: Number(db.created_at_ts),
        createdBy: db.created_by,
        enabled: db.enabled
    };
}

// Helper to map Frontend data to DB columns
function mapToDb(data: any) {
    const db: any = {};
    if (data.code !== undefined) db.code = data.code;
    if (data.description !== undefined) db.description = data.description;
    if (data.rewards !== undefined) {
        db.rewards = data.rewards;
        // Automatically populated cosmetic_ids for the mod logic
        const cosmetics = (data.rewards || [])
            .filter((r: any) => r.type === 'cosmetic' && r.cosmeticData?.itemId)
            .map((r: any) => r.cosmeticData.itemId);
        if (cosmetics.length > 0) db.cosmetic_ids = cosmetics;
        else db.cosmetic_ids = [];
    }
    if (data.maxUses !== undefined) db.max_uses = data.maxUses;
    if (data.expiresAt !== undefined) db.expires_at = data.expiresAt;
    if (data.requiresMembership !== undefined) db.requires_membership = data.requiresMembership;
    if (data.enabled !== undefined) db.enabled = data.enabled;
    if (data.createdBy !== undefined) db.created_by = data.createdBy;
    if (data.createdAt !== undefined) db.created_at_ts = data.createdAt;
    return db;
}

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
     const { authorized, response } = await requireAdmin(event);
     if (!authorized) return response;

     if (event.httpMethod === 'GET') {
         const { data, error } = await supabaseAdmin
            .from('redeem_codes')
            .select('*')
            .order('created_at', { ascending: false });
            
         if (error) throw error;
         return corsResponse(200, { codes: (data || []).map(mapFromDb) });
     }

     if (event.httpMethod === 'POST') {
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         
         const dbRecord = mapToDb(body);
         const { error } = await supabaseAdmin.from('redeem_codes').insert({
             ...dbRecord,
             id: body.id || crypto.randomUUID(),
             created_at_ts: dbRecord.created_at_ts || Date.now(),
             created_by: dbRecord.created_by || 'admin'
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

     if (event.httpMethod === 'PATCH' || event.httpMethod === 'PUT') {
         let body: any = {};
         try { body = JSON.parse(event.body || '{}'); } catch(e) {}
         
         const id = body.id;
         if (!id) return corsResponse(400, { error: 'ID required for updates' });
         
         const updates = mapToDb(body);
         const { error } = await supabaseAdmin.from('redeem_codes').update(updates).eq('id', id);
         
         if (error) throw error;
         return corsResponse(200, { success: true });
     }

     return corsResponse(405, { error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Redeem codes admin error:', error);
    return corsResponse(500, { error: error.message });
  }
};
