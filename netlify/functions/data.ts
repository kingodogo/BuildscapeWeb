
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

      // Single Report or Suggestion submission: Allow guests for NEW ones, Authenticated for updates
      if ((report || suggestion) && !reports && !suggestions && !config && !changelogs) {
          const { user, profile } = await verifyAuthToken(event);
          const userRole = profile?.role?.toLowerCase() || 'user';
          const isAdmin = userRole === 'admin' || userRole === 'owner';
          
          if (report) {
              // VALIDATION
              if (!report.title || report.title.length < 5 || report.title.length > 200) {
                  return corsResponse(400, { error: "Title must be between 5 and 200 characters" });
              }
              if (report.description?.length > 10000) {
                  return corsResponse(400, { error: "Description too long" });
              }
              
              // Trusted Domains Validation for links
              const TRUSTED_DOMAINS = ['pastebin.com', 'imgur.com', 'youtube.com', 'youtu.be', 'github.com', 'githubusercontent.com', 'discordapp.com', 'discord.com', 'mediafire.com', 'google.com', 'drive.google.com', 'dropbox.com'];
              if (report.links && Array.isArray(report.links)) {
                  for (const link of report.links) {
                      try {
                          if (link.startsWith('javascript:')) throw new Error('Invalid protocol');
                          const url = new URL(link);
                          const isTrusted = TRUSTED_DOMAINS.some(domain => url.hostname.includes(domain));
                          if (!isTrusted) return corsResponse(400, { error: `Untrusted link: ${url.hostname}` });
                      } catch (e) {
                          return corsResponse(400, { error: "Invalid link format" });
                      }
                  }
              }

              const snakeReport = mapToSnakeCase(report);
              let existing = null;
              if (snakeReport.id) {
                  const { data } = await supabaseAdmin.from('reports').select('author_id').eq('id', snakeReport.id).maybeSingle();
                  existing = data;
              }

              if (existing) {
                  if (!user) return corsResponse(401, { error: 'Authentication required to update reports' });
                  if (existing.author_id !== user.id && !isAdmin) {
                      return corsResponse(403, { error: "You do not have permission to update this report" });
                  }
                  snakeReport.author_id = existing.author_id;
              } else {
                  snakeReport.author_id = user?.id || null;
              }
              
              const { error: upsertError } = await supabaseAdmin.from('reports').upsert(snakeReport);
              if (upsertError) throw upsertError;
          }
           
          if (suggestion) {
              // VALIDATION
              if (!suggestion.title || suggestion.title.length < 5 || suggestion.title.length > 200) {
                  return corsResponse(400, { error: "Title must be between 5 and 200 characters" });
              }
              if (suggestion.description?.length > 5000) {
                  return corsResponse(400, { error: "Description too long" });
              }

              const snakeSuggestion = mapToSnakeCase(suggestion);
              let existing = null;
              if (snakeSuggestion.id) {
                  const { data } = await supabaseAdmin.from('suggestions').select('author_id').eq('id', snakeSuggestion.id).maybeSingle();
                  existing = data;
              }

              if (existing) {
                  if (!user) return corsResponse(401, { error: 'Authentication required to update suggestions' });
                  if (existing.author_id !== user.id && !isAdmin) {
                      return corsResponse(403, { error: "You do not have permission to update this suggestion" });
                  }
                  snakeSuggestion.author_id = existing.author_id;
              } else {
                  snakeSuggestion.author_id = user?.id || null;
              }

              const { error: upsertError } = await supabaseAdmin.from('suggestions').upsert(snakeSuggestion);
              if (upsertError) throw upsertError;
          }
          return corsResponse(200, { success: true });
      }

      // Bulk or Sensitive updates: require Admin
      const { authorized, response, profile: adminProfile } = await requireAdmin(event);
      if (!authorized) return response;
      const adminRole = adminProfile?.role?.toLowerCase();
      const isActuallyAdmin = adminRole === 'admin' || adminRole === 'owner';
      if (!isActuallyAdmin) return corsResponse(403, { error: "Administrative privileges required" });

      // Single Report Update (Admin override)
      if (report) {
         const snakeReport = mapToSnakeCase(report);
         const { error } = await supabaseAdmin.from('reports').upsert(snakeReport);
         if (error) throw error;
         return corsResponse(200, { success: true });
      }

      // Single Suggestion Update (Admin override)
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
        
        const { error } = await supabaseAdmin.from('config').upsert({
           id: 'main_config',
           data: configWithoutChangelogs,
           updated_at: new Date().toISOString()
        });
        if (error) throw error;

        if (!changelogs && configChangelogs && Array.isArray(configChangelogs)) {
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
      const { authorized, response, profile: adminProfile } = await requireAdmin(event);
      if (!authorized) return response;
      const adminRole = adminProfile?.role?.toLowerCase();
      if (adminRole !== 'admin' && adminRole !== 'owner') return corsResponse(403, { error: "Administrative privileges required" });

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