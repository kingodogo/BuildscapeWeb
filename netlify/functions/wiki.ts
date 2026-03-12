
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
      let body: any = {};
      try { body = JSON.parse(event.body || '{}'); } catch(e) {}
      
      const { action, featureId } = body;

      // User Actions
      if (action === 'like' || action === 'favorite') {
        const { user } = await verifyAuthToken(event);

        // Anonymous like support
        if (action === 'like' && !user) {
          const { isLiking } = body;
          if (typeof isLiking !== 'boolean') {
             return corsResponse(400, { error: "isLiking boolean required for anonymous likes" });
          }
          const { data: featureData, error: selectErr } = await supabaseAdmin.from('wiki_features').select('likes').eq('id', featureId).single();
          if (selectErr && selectErr.code !== 'PGRST116') throw selectErr; // Ignore no rows error if it somehow happens but throw others
          const currentLikes = featureData?.likes || 0;
          const newLikes = isLiking ? currentLikes + 1 : Math.max(0, currentLikes - 1);
          
          const { error: updateErr } = await supabaseAdmin.from('wiki_features').update({ likes: newLikes }).eq('id', featureId);
          if (updateErr) throw updateErr;

          return corsResponse(200, { success: true, liked: isLiking, newLikes });
        }

        if (!user) return corsResponse(401, { error: "Unauthorized" });

        const userId = user.id;

        // Fetch current user profile
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from('profiles')
          .select('liked_features, favorite_features')
          .eq('id', userId)
          .single();
          
        if (profileErr) throw profileErr;

        let liked = profile.liked_features || [];
        let favs = profile.favorite_features || [];

        if (action === 'like') {
          const alreadyLiked = liked.includes(featureId);
          if (alreadyLiked) {
            liked = liked.filter((id: string) => id !== featureId);
          } else {
            liked.push(featureId);
          }
          
          // Update user's liked
          await supabaseAdmin.from('profiles').update({ liked_features: liked }).eq('id', userId);
          
          // Update feature's like count
          const { data: featureData } = await supabaseAdmin.from('wiki_features').select('likes').eq('id', featureId).single();
          const currentLikes = featureData?.likes || 0;
          await supabaseAdmin.from('wiki_features').update({ likes: alreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1 }).eq('id', featureId);
          
          return corsResponse(200, { success: true, liked: !alreadyLiked });
        }

        if (action === 'favorite') {
          const alreadyFav = favs.includes(featureId);
          if (alreadyFav) {
            favs = favs.filter((id: string) => id !== featureId);
          } else {
            favs.push(featureId);
          }
          await supabaseAdmin.from('profiles').update({ favorite_features: favs }).eq('id', userId);
          return corsResponse(200, { success: true, favorited: !alreadyFav });
        }
      }

      // Admin Actions
      const { authorized, response } = await requireAdmin(event);
      if (!authorized) return response;

      const { feature } = body;
      if (!feature || !feature.title) {
         return corsResponse(400, { error: "Feature title required" });
      }
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