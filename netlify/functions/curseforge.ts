
import { corsResponse } from './lib/supabaseHelpers';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  const { action, projectSlug } = event.queryStringParameters || {};
  const apiToken = process.env.CURSEFORGE_API_KEY;

  if (!apiToken && action !== 'gameVersions' && action !== 'gameDependencies') {
    return corsResponse(400, { error: 'CurseForge API key missing' });
  }

  try {
    if (action === 'gameVersions') {
        const res = await fetch('https://minecraft.curseforge.com/api/game/versions', {
            headers: { 'Content-Type': 'application/json', ...(apiToken && { 'X-Api-Token': apiToken }) }
        });
        if (!res.ok) throw new Error(res.statusText);
        return corsResponse(200, { data: await res.json() });
    }

    if (action === 'gameDependencies') {
        const res = await fetch('https://minecraft.curseforge.com/api/game/dependencies', {
            headers: { 'Content-Type': 'application/json', ...(apiToken && { 'X-Api-Token': apiToken }) }
        });
        if (!res.ok) throw new Error(res.statusText);
        return corsResponse(200, { data: await res.json() });
    }

    if (action === 'projectFiles') {
        if (!projectSlug) return corsResponse(400, { error: 'Project slug required' });
        
        // Resolve Project ID logic (simplified for brevity but robust enough)
        let projectId = projectSlug;
        
        // Try to fetch mod info to get numeric ID if slug is text
        if (!/^\d+$/.test(projectId)) {
             const res = await fetch(`https://www.curseforge.com/api/v1/mods/${encodeURIComponent(projectSlug)}`, {
                 headers: { 'Content-Type': 'application/json', 'X-Api-Token': apiToken! }
             });
             if (res.ok) {
                 const data = await res.json();
                 if (data.data?.id) projectId = data.data.id.toString();
             }
        }

        const res = await fetch(`https://www.curseforge.com/api/v1/mods/${projectId}/files`, {
             headers: { 'Content-Type': 'application/json', 'X-Api-Token': apiToken! }
        });

        if (!res.ok) {
             // Fallback to strict numeric check if failed
             return corsResponse(res.status, { error: "Failed to fetch project files" });
        }

        const data = await res.json();
        const files = data.data || [];
        
        // Changelog fetching logic (simplified loop)
        const filesWithChangelogs = await Promise.all(files.slice(0, 50).map(async (file: any) => {
             // Try to find changelog in file object
             let changelog = file.changelog || file.changelogHtml || file.changelogText || '';
             let type = 'text';

             if (!changelog && projectId) {
                 // Fetch specific file changelog
                 try {
                     const clRes = await fetch(`https://www.curseforge.com/api/v1/mods/${projectId}/files/${file.id}/change-log`, {
                        headers: { 'Content-Type': 'application/json', 'X-Api-Token': apiToken! }
                     });
                     if (clRes.ok) {
                         const clData = await clRes.json();
                         if (clData.data) {
                             changelog = typeof clData.data === 'string' ? clData.data : (clData.data.html || clData.data.text || '');
                             type = clData.data.html ? 'html' : 'text';
                         }
                     }
                 } catch(e) {}
             }
             
             file.changelog = changelog;
             file.changelogType = type;
             return file;
        }));

        return corsResponse(200, { data: filesWithChangelogs });
    }

    if (action === 'projectInfo') {
        if (!projectSlug) return corsResponse(400, { error: 'Project slug required' });
        const res = await fetch(`https://www.curseforge.com/api/v1/mods/${projectSlug}`, {
             headers: { 'Content-Type': 'application/json', ...(apiToken && { 'X-Api-Token': apiToken }) }
        });
        if (!res.ok) return corsResponse(res.status, { error: "Project not found" });
        return corsResponse(200, await res.json());
    }

    return corsResponse(400, { error: 'Invalid action' });

  } catch (error: any) {
    console.error("CurseForge Error:", error);
    return corsResponse(500, { error: error.message });
  }
};
