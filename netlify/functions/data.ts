
import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyAuthToken, requireAdmin, corsResponse } from './lib/supabaseHelpers';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  try {
    // GET: Fetch all data (public, cached logic not strictly needed if Supabase is fast, but we can implement basic caching headers)
    if (event.httpMethod === 'GET') {
      // Parallel fetch
      const [reportsRes, suggestionsRes, configRes, changelogsRes] = await Promise.all([
        supabaseAdmin.from('reports').select('*').order('timestamp', { ascending: false }),
        supabaseAdmin.from('suggestions').select('*').order('timestamp', { ascending: false }),
        supabaseAdmin.from('config').select('data').eq('id', 'main_config').single(),
        supabaseAdmin.from('changelogs').select('*').order('file_date', { ascending: false }) // Check column name mapping. Code uses file_date?
        // Spec table: file_date TEXT. DB table: file_date.
        // But original code sorting: sort({ fileDate: -1 }).
        // I should check if I used snake_case in schema. Yes: file_name, file_date.
        // Frontend expects camelCase probably. I need to map snake_case to camelCase likely.
      ]);

      if (reportsRes.error) throw reportsRes.error;
      if (suggestionsRes.error) throw suggestionsRes.error;
      // config might be null
      if (changelogsRes.error) throw changelogsRes.error;

      // Map snake_case to expected camelCase for frontend compatibility
      // Helper function to map keys? Or just return as is if frontend adapts?
      // The Spec says "Migrate ... default to Netlify".
      // Usually Supabase returns columns as defined in SQL. My SQL used snake_case.
      // MongoDB used camelCase/mixed.
      // I should map them to ensure frontend doesn't break.
      
      const reports = (reportsRes.data || []).map(mapToCamelCase);
      const suggestions = (suggestionsRes.data || []).map(mapToCamelCase);
      const configData = configRes.data?.data || null; // JSONB is already in whatever format stored
      const changelogs = (changelogsRes.data || []).map(mapToCamelCase);

      const configWithChangelogs = configData ? {
        ...configData,
        changelogs
      } : null;

      return corsResponse(200, {
        reports,
        suggestions,
        config: configWithChangelogs
      });
    }

    // POST: Update data (Authenticated users for single, Admin for bulk/config)
    if (event.httpMethod === 'POST') {
      let body: any = {};
      try { body = JSON.parse(event.body || '{}'); } catch(e) {}
      
      const { reports, suggestions, config, report, suggestion, changelogs } = body;

      // Single Report or Suggestion submission: Allow any authenticated user
      if ((report || suggestion) && !reports && !suggestions && !config && !changelogs) {
          const { user, error } = await verifyAuthToken(event);
          if (error || !user) {
              return corsResponse(401, { error: error || 'Authentication required to submit reports' });
          }
          
          if (report) {
              const snakeReport = mapToSnakeCase(report);
              // Ensure user owns the report if updating
              if (snakeReport.id) {
                 const { data: existing } = await supabaseAdmin.from('reports').select('author_id').eq('id', snakeReport.id).maybeSingle();
                 if (existing && existing.author_id !== user.id) {
                     return corsResponse(403, { error: "You do not have permission to update this report" });
                 }
              }
              // Force author_id to current user
              snakeReport.author_id = user.id;
              const { error: upsertError } = await supabaseAdmin.from('reports').upsert(snakeReport);
              if (upsertError) throw upsertError;
          }
           
          if (suggestion) {
              const snakeSuggestion = mapToSnakeCase(suggestion);
              // Ensure user owns the suggestion if updating
              if (snakeSuggestion.id) {
                 const { data: existing } = await supabaseAdmin.from('suggestions').select('author_id').eq('id', snakeSuggestion.id).maybeSingle();
                 if (existing && existing.author_id !== user.id) {
                     return corsResponse(403, { error: "You do not have permission to update this suggestion" });
                 }
              }
              // Force author_id to current user
              snakeSuggestion.author_id = user.id;
              const { error: upsertError } = await supabaseAdmin.from('suggestions').upsert(snakeSuggestion);
              if (upsertError) throw upsertError;
          }
          return corsResponse(200, { success: true });
      }

      // Bulk or Sensitive updates: require Admin
      const { authorized, response } = await requireAdmin(event);
      if (!authorized) return response;

      // Single Report Update
      if (report) {
         const snakeReport = mapToSnakeCase(report);
         const { error } = await supabaseAdmin.from('reports').upsert(snakeReport);
         if (error) throw error;
         return corsResponse(200, { success: true });
      }

      // Single Suggestion Update
      if (suggestion) {
         const snakeSuggestion = mapToSnakeCase(suggestion);
         const { error } = await supabaseAdmin.from('suggestions').upsert(snakeSuggestion);
         if (error) throw error;
         return corsResponse(200, { success: true });
      }

      // Bulk Reports
      if (reports && Array.isArray(reports) && reports.length > 0) {
        const snakeReports = reports.map(mapToSnakeCase);
        const { error } = await supabaseAdmin.from('reports').upsert(snakeReports);
        if (error) throw error;
      }

      // Bulk Suggestions
      if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
        const snakeSuggestions = suggestions.map(mapToSnakeCase);
        const { error } = await supabaseAdmin.from('suggestions').upsert(snakeSuggestions);
        if (error) throw error;
      }

      // Config Update
      if (config) {
        const { changelogs: configChangelogs, ...configWithoutChangelogs } = config;
        
        // Update main_config
        const { error } = await supabaseAdmin.from('config').upsert({
           id: 'main_config',
           data: configWithoutChangelogs,
           updated_at: new Date().toISOString()
        });
        if (error) throw error;

        // Handle nested changelogs if provided and top-level changelogs not present
        if (!changelogs && configChangelogs && Array.isArray(configChangelogs)) {
           // Delete all and insert new
           await supabaseAdmin.from('changelogs').delete().neq('id', 'placeholder_impossible_id');
           if (configChangelogs.length > 0) {
              const snakeChangelogs = configChangelogs.map(mapToSnakeCase);
              const { error: clError } = await supabaseAdmin.from('changelogs').insert(snakeChangelogs);
              if (clError) throw clError;
           }
        }
      }

      // Standalone Changelogs Update
      if (changelogs && Array.isArray(changelogs)) {
           await supabaseAdmin.from('changelogs').delete().neq('id', 'placeholder_impossible_id');
           if (changelogs.length > 0) {
              const snakeChangelogs = changelogs.map(mapToSnakeCase);
              const { error: clError } = await supabaseAdmin.from('changelogs').insert(snakeChangelogs);
              if (clError) throw clError;
           }
      }

      return corsResponse(200, { success: true });
    }

    // DELETE: Delete Item (Admin only)
    if (event.httpMethod === 'DELETE') {
      const { authorized, response } = await requireAdmin(event);
      if (!authorized) return response;

      const { id, type } = event.queryStringParameters || {};
      if (!id) return corsResponse(400, { error: "ID required" });

      const table = type === 'suggestion' ? 'suggestions' : 'reports';
      
      const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
      if (error) throw error;

      return corsResponse(200, { success: true });
    }

    return corsResponse(405, { error: "Method not allowed" });
  } catch (error: any) {
    console.error("Data API Error:", error);
    return corsResponse(500, { error: error.message || "Internal Server Error" });
  }
};

// Utils for mapping camelCase <-> snake_case

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
    // Special handling if needed, or simple regex
    const newKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[newKey] = mapToSnakeCase(obj[key]);
  }
  return newObj;
}