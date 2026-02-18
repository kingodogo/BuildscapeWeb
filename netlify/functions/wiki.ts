
import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyAuthToken, requireAdmin, corsResponse } from './lib/supabaseHelpers';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
    // GET: List Features (Public)
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('wiki_features')
        .select('*')
        .order('categories', { ascending: true }) // Can't easily sort by array content, sorting by title fallback
        .order('title', { ascending: true });

      if (error) throw error;
      
      // Map back to expected format (camelCase)
      const features = (data || []).map(mapToCamelCase);
      return corsResponse(200, { features });
    }

    // POST: Create/Update Feature (Admin Only)
    // Supports older format migration if needed (though Supabase usually implies strict schema, 
    // the request might send old structure. We map it.)
    if (event.httpMethod === 'POST') {
      const { authorized, response } = await requireAdmin(event);
      if (!authorized) return response;

      let body: any = {};
      try { body = JSON.parse(event.body || '{}'); } catch(e) {}
      
      const { feature } = body;
      if (!feature || !feature.title) {
         return corsResponse(400, { error: "Feature title required" });
      }

      // Mapping logic for old fields (from api/wiki.ts)
      const mappedFeature = {
        id: feature.id || crypto.randomUUID(),
        title: feature.title,
        mc_versions: feature.mcVersions || (feature.version ? [feature.version] : []) || [],
        mod_versions: feature.modVersions || (feature.modVersion ? [feature.modVersion] : []) || [],
        categories: feature.categories || (feature.category ? [feature.category] : []) || [],
        subcategories: feature.subcategories || (feature.subcategory ? [feature.subcategory] : []) || [],
        description: feature.description || '',
        description_type: feature.descriptionType || 'text',
        media: feature.media || (feature.image || feature.video),
        details: feature.details || [],
        created_by: feature.createdBy || 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('wiki_features')
        .upsert(mappedFeature)
        .select()
        .single();

      if (error) throw error;

      return corsResponse(200, { success: true, feature: mapToCamelCase(data) });
    }

    // PUT: Update Feature (Admin Only) -> Same as POST Upsert effectively
    if (event.httpMethod === 'PUT') {
      const { authorized, response } = await requireAdmin(event);
      if (!authorized) return response;

      let body: any = {};
      try { body = JSON.parse(event.body || '{}'); } catch(e) {}
      
      const { feature } = body;
      if (!feature || !feature.id) {
         return corsResponse(400, { error: "Feature ID required" });
      }

      const mappedFeature = mapToSnakeCase(feature);
      mappedFeature.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('wiki_features')
        .update(mappedFeature)
        .eq('id', feature.id);

      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    // DELETE: Delete Feature (Admin Only)
    if (event.httpMethod === 'DELETE') {
      const { authorized, response } = await requireAdmin(event);
      if (!authorized) return response;

      const { id } = event.queryStringParameters || {};
      if (!id) return corsResponse(400, { error: "ID required" });

      const { error } = await supabaseAdmin
        .from('wiki_features')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    return corsResponse(405, { error: "Method not allowed" });
  } catch (error: any) {
    console.error("Wiki API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
};

function mapToCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(mapToCamelCase);
  const newObj: any = {};
  for (const key in obj) {
    const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[newKey] = mapToCamelCase(obj[key]);
  }
  return newObj;
}

function mapToSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(mapToSnakeCase);
  const newObj: any = {};
  for (const key in obj) {
    const newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[newKey] = mapToSnakeCase(obj[key]);
  }
  return newObj;
}