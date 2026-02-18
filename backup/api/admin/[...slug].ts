import clientPromise from '../../lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RedeemCode, User } from '../../types';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers FIRST - before any other response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Log incoming request for debugging
  console.log('=== ADMIN HANDLER CALLED ===', {
    url: req.url,
    method: req.method,
    query: req.query,
    slug: req.query?.slug,
    headers: { host: req.headers.host }
  });

  // CRITICAL: Always return JSON, never let Vercel return HTML
  try {
    const uri = process.env.MONGODB_URI || process.env.BuildScape_MONGODB_URI;
  
    if (!uri) {
      return res.status(503).json({ error: "Database not configured. Please set MONGODB_URI environment variable." });
    }

    // ALWAYS parse route directly from URL - don't rely on Vercel's slug parameter
    let route = '';
    const url = (req?.url && typeof req.url === 'string') ? req.url : '';
    
    console.log('=== ADMIN HANDLER: Parsing route ===', { 
      url, 
      query: req.query,
      slug: req.query?.slug,
      slugType: typeof req.query?.slug,
      slugIsArray: Array.isArray(req.query?.slug)
    });
    
    // Method 1: Try Vercel's slug parameter first (can be string or array)
    if (req.query?.slug) {
      const slug = req.query.slug;
      if (Array.isArray(slug)) {
        route = slug[0] || slug.join('/');
      } else {
        route = slug;
      }
      console.log('=== ADMIN HANDLER: Route from slug ===', route);
    }
    
    // Method 2: Regex from URL (most reliable)
    if (!route && url) {
      const pathMatch = url.match(/\/api\/admin\/([^/?]+)/);
      if (pathMatch && pathMatch[1]) {
        route = pathMatch[1];
        console.log('=== ADMIN HANDLER: Route from regex ===', route);
      }
    }
    
    // Method 3: Split URL
    if (!route && url) {
      const parts = url.split('?')[0].split('/').filter(Boolean);
      const adminIdx = parts.indexOf('admin');
      if (adminIdx >= 0 && adminIdx < parts.length - 1) {
        route = parts[adminIdx + 1];
        console.log('=== ADMIN HANDLER: Route from split ===', route);
      }
    }
    
    // Method 4: If route is still empty but we have a slug, use it
    if (!route && req.query?.slug) {
      const slug = req.query.slug;
      route = Array.isArray(slug) ? slug[0] : slug;
      console.log('=== ADMIN HANDLER: Route from slug fallback ===', route);
    }
    
    console.log('=== ADMIN HANDLER: Final route ===', { route, url, slug: req.query?.slug });
    
    // If still no route, return error
    if (!route) {
      console.error('=== ADMIN HANDLER: NO ROUTE FOUND ===', { 
        url, 
        query: req.query,
        headers: req.headers
      });
      return res.status(400).json({ 
        error: "Could not determine admin route from URL",
        url: url,
        query: req.query,
        message: "Please check the URL format: /api/admin/redeem-codes",
        debug: {
          slug: req.query?.slug,
          slugType: typeof req.query?.slug,
          urlParts: url.split('?')[0].split('/').filter(Boolean)
        }
      });
    }

    const client = await clientPromise;
    const db = client.db("buildscape_tracker");

    console.log('=== ADMIN HANDLER: Routing to handler ===', { route });

    // Route: /api/admin/redeem-codes
    if (route === 'redeem-codes') {
      console.log('=== ADMIN HANDLER: Handling redeem-codes ===', { method: req.method });
      
      if (req.method === 'GET') {
        console.log('=== Fetching redeem codes from database ===');
        const codes = await db.collection("redeem_codes").find({}).sort({ createdAt: -1 }).toArray();
        console.log(`=== Found ${codes.length} codes ===`);
        
        const cleanCodes = codes.map((c: any) => {
          const { _id, ...rest } = c;
          return rest;
        });

        console.log('=== Returning codes ===', cleanCodes.length);
        return res.status(200).json({ codes: cleanCodes });
      }

      if (req.method === 'POST') {
        const { code, description, rewards, maxUses, expiresAt, requiresMembership, enabled } = req.body;

        if (!code || typeof code !== 'string') {
          return res.status(400).json({ error: "Code is required" });
        }

        if (!rewards || !Array.isArray(rewards) || rewards.length === 0) {
          return res.status(400).json({ error: "At least one reward is required" });
        }

        const existingCode = await db.collection("redeem_codes").findOne({ 
          code: code.toUpperCase().trim() 
        });

        if (existingCode) {
          return res.status(400).json({ error: "Code already exists" });
        }

        const newCode: RedeemCode = {
          id: generateUUID(),
          code: code.toUpperCase().trim(),
          rewards: rewards,
          description: description || '',
          maxUses: maxUses || undefined,
          usedCount: 0,
          expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
          requiresMembership: requiresMembership || undefined,
          createdAt: Date.now(),
          createdBy: req.body.createdBy || 'admin',
          enabled: enabled !== undefined ? enabled : true
        };

        await db.collection("redeem_codes").insertOne(newCode);

        const cleanCode: any = { ...newCode };
        delete (cleanCode as any)._id;
        return res.status(200).json({ code: cleanCode, success: true });
      }

      if (req.method === 'PUT') {
        const { id, code, description, rewards, maxUses, expiresAt, requiresMembership, enabled } = req.body;

        if (!id) {
          return res.status(400).json({ error: "Code ID is required" });
        }

        const updateData: any = {};
        
        if (code !== undefined) updateData.code = code.toUpperCase().trim();
        if (description !== undefined) updateData.description = description;
        if (rewards !== undefined) updateData.rewards = rewards;
        if (maxUses !== undefined) updateData.maxUses = maxUses;
        if (expiresAt !== undefined) {
          updateData.expiresAt = expiresAt ? new Date(expiresAt).getTime() : undefined;
        }
        if (requiresMembership !== undefined) updateData.requiresMembership = requiresMembership;
        if (enabled !== undefined) updateData.enabled = enabled;

        const result = await db.collection("redeem_codes").updateOne(
          { id: id },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Code not found" });
        }

        return res.status(200).json({ success: true });
      }

      if (req.method === 'DELETE') {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: "Code ID is required" });
        }

        const result = await db.collection("redeem_codes").deleteOne({ id });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Code not found" });
        }

        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: "Method not allowed" });
    }

    // Route: /api/admin/code-redemptions
    if (route === 'code-redemptions') {
      console.log('=== ADMIN HANDLER: Handling code-redemptions ===', { method: req.method });
      
      if (req.method === 'GET') {
        console.log('=== Fetching code redemptions from database ===');
        const { codeId, startDate, endDate } = req.query;
        
        console.log('=== Query params ===', { codeId, startDate, endDate });

        const query: any = {};
        if (codeId && typeof codeId === 'string' && codeId !== 'all') {
          query.codeId = codeId;
        }
        
        if (startDate || endDate) {
          query.redeemedAt = {};
          if (startDate && typeof startDate === 'string') {
            query.redeemedAt.$gte = parseInt(startDate);
          }
          if (endDate && typeof endDate === 'string') {
            query.redeemedAt.$lte = parseInt(endDate);
          }
        }

        console.log('=== MongoDB query ===', JSON.stringify(query));
        const redemptions = await db.collection("code_redemptions")
          .find(query)
          .sort({ redeemedAt: -1 })
          .toArray();
        
        console.log(`=== Found ${redemptions.length} redemptions ===`);

        const userIds = Array.from(new Set(redemptions.map((r: any) => r.userId).filter(Boolean)));
        console.log(`=== Fetching ${userIds.length} users ===`);
        
        let users: any[] = [];
        if (userIds.length > 0) {
          users = await db.collection("users")
            .find({ id: { $in: userIds } })
            .toArray();
        }
        
        const userMap = new Map(users.map((u: any) => [u.id, u as User]));

        const redemptionsWithUsers = redemptions.map((r: any) => {
          const { _id, ...redemption } = r;
          const user = userMap.get(r.userId) as User | undefined;
          return {
            ...redemption,
            username: user?.username || 'Unknown',
            email: user?.email || null,
            minecraftUsername: user?.minecraftUsername || null
          };
        });

        console.log('=== Returning redemptions ===', redemptionsWithUsers.length);
        return res.status(200).json({ redemptions: redemptionsWithUsers });
      }

      return res.status(405).json({ error: "Method not allowed" });
    }

    // Route: /api/admin/curseforge
    if (route === 'curseforge') {
      console.log('=== ADMIN HANDLER: Calling handleCurseForge ===');
      return await handleCurseForge(req, res);
    }

    console.error('=== ADMIN HANDLER: Route not found ===', { route, url });
    return res.status(404).json({ 
      error: "Not found", 
      route: route,
      url: url,
      slug: req.query?.slug,
      message: `Admin route '${route}' not found. Available routes: redeem-codes, code-redemptions, curseforge`
    });
  } catch (error: any) {
    console.error("=== ADMIN HANDLER ERROR ===", error);
    console.error("=== ADMIN HANDLER ERROR STACK ===", error.stack);
    // Make sure we return JSON, not HTML
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: error.message || "Internal server error",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}


async function handleCurseForge(req: VercelRequest, res: VercelResponse) {
  console.log('=== handleCurseForge CALLED ===', { method: req.method, url: req.url });
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Token');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, projectSlug } = req.query;
  const apiToken = process.env.CURSEFORGE_API_KEY;

  if (!apiToken && action !== 'gameVersions' && action !== 'gameDependencies') {
    return res.status(400).json({ error: 'CurseForge API key not configured. Please set CURSEFORGE_API_KEY in environment variables.' });
  }

  try {
    switch (action) {
      case 'gameVersions': {
        const response = await fetch('https://minecraft.curseforge.com/api/game/versions', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(apiToken && { 'X-Api-Token': apiToken }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch game versions: ${response.statusText}`);
        }

        const data = await response.json();
        return res.status(200).json({ data });
      }

      case 'gameDependencies': {
        const response = await fetch('https://minecraft.curseforge.com/api/game/dependencies', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(apiToken && { 'X-Api-Token': apiToken }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch dependencies: ${response.statusText}`);
        }

        const data = await response.json();
        return res.status(200).json({ data });
      }

      case 'projectFiles': {
        if (!projectSlug) {
          return res.status(400).json({ error: 'Project slug is required' });
        }

        if (!apiToken) {
          return res.status(400).json({ error: 'API token required for project files. Please set CURSEFORGE_API_KEY in environment variables.' });
        }

        let projectId: string | null = null;
        let projectSlugForWeb: string = projectSlug as string;
        
        if (/^\d+$/.test(projectSlug as string)) {
          projectId = projectSlug as string;
          try {
            const projectInfoForSlug = await fetch(`https://www.curseforge.com/api/v1/mods/${projectId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Token': apiToken,
              },
            });
            if (projectInfoForSlug.ok) {
              const projectData = await projectInfoForSlug.json();
              if (projectData.data && projectData.data.slug) {
                projectSlugForWeb = projectData.data.slug;
              }
            }
          } catch (e) {
          }
        } else {
          try {
            const projectInfoResponse = await fetch(`https://www.curseforge.com/api/v1/mods/${encodeURIComponent(projectSlug as string)}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (projectInfoResponse.ok) {
              const projectData = await projectInfoResponse.json();
              if (projectData.data && projectData.data.id) {
                projectId = projectData.data.id.toString();
              }
            } else if (projectInfoResponse.status === 403 || projectInfoResponse.status === 401) {
              projectId = projectSlug as string;
            }
          } catch (e) {
            projectId = projectSlug as string;
          }

          if (!projectId) {
            try {
              const projectInfoResponse = await fetch(`https://www.curseforge.com/api/v1/mods/${encodeURIComponent(projectSlug as string)}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Api-Token': apiToken,
                },
              });
              
              if (projectInfoResponse.ok) {
                const projectData = await projectInfoResponse.json();
                if (projectData.data && projectData.data.id) {
                  projectId = projectData.data.id.toString();
                }
              } else if (projectInfoResponse.status === 403 || projectInfoResponse.status === 401) {
                projectId = projectSlug as string;
              } else {
                return res.status(projectInfoResponse.status).json({ 
                  error: `Failed to find project: ${projectInfoResponse.statusText}. Please verify the project slug "${projectSlug}" is correct.` 
                });
              }
            } catch (e: any) {
              projectId = projectSlug as string;
            }
          }
        }

        if (!projectId) {
          return res.status(400).json({ error: 'Could not resolve project ID from slug' });
        }

        let response: Response | null = null;
        
        try {
          const url = `https://www.curseforge.com/api/v1/mods/${projectId}/files`;
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Token': apiToken,
            },
          });

          if (!response.ok && /^\d+$/.test(projectId)) {
            const oldApiUrl = `https://minecraft.curseforge.com/api/projects/${projectId}/files`;
            const oldApiResponse = await fetch(oldApiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Token': apiToken,
              },
            });
            
            if (oldApiResponse.ok) {
              const oldApiData = await oldApiResponse.json();
              return res.status(200).json({ data: oldApiData });
            }
          }

          if (!response.ok) {
            let errorMessage = `Failed to fetch project files: ${response.status} ${response.statusText}`;
            
            if (response.status === 400) {
              errorMessage = `Bad Request (400). Please verify the project ID/slug format is correct.`;
            } else if (response.status === 401 || response.status === 403) {
              errorMessage = 'Authentication failed. Please check your CURSEFORGE_API_KEY in environment variables.';
            } else if (response.status === 404) {
              errorMessage = `Project not found. Please verify the project slug/ID "${projectSlug}" is correct.`;
            }
            
            return res.status(response.status).json({ error: errorMessage });
          }
        } catch (e: any) {
          return res.status(500).json({ error: `Failed to fetch project files: ${e.message}` });
        }

        const data = await response.json();
        let files = data.data || [];
        
        const filesWithChangelogs = await Promise.all(
          files.slice(0, 100).map(async (file: any) => {
            let changelog = file.changelog || file.changelogHtml || file.changelogMarkdown || file.changelogText || '';
            let changelogType: 'text' | 'html' | 'markdown' = 'text';
            
            if (file.changelogHtml) {
              changelog = file.changelogHtml;
              changelogType = 'html';
            } else if (file.changelogMarkdown) {
              changelog = file.changelogMarkdown;
              changelogType = 'markdown';
            } else if (file.changelogText) {
              changelog = file.changelogText;
              changelogType = 'text';
            } else if (file.changelog) {
              changelog = file.changelog;
              changelogType = file.changelogType || 'text';
            }
            
            if (!changelog && file.id && projectId) {
              try {
                const fileDetailResponse = await fetch(`https://www.curseforge.com/api/v1/mods/${projectId}/files/${file.id}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Token': apiToken,
                  },
                });
                
                if (fileDetailResponse.ok) {
                  const fileDetailData = await fileDetailResponse.json();
                  if (fileDetailData.data) {
                    const detail = fileDetailData.data;
                    changelog = detail.changelog || detail.changelogText || detail.changelogHtml || detail.changelogMarkdown || detail.changeLog || detail.changeLogText || detail.changeLogHtml || detail.changeLogMarkdown || '';
                    if (detail.changelogHtml || detail.changeLogHtml) {
                      changelogType = 'html';
                      changelog = changelog || detail.changelogHtml || detail.changeLogHtml;
                    } else if (detail.changelogMarkdown || detail.changeLogMarkdown) {
                      changelogType = 'markdown';
                      changelog = changelog || detail.changelogMarkdown || detail.changeLogMarkdown;
                    } else if (changelog) {
                      changelogType = 'text';
                    }
                  }
                }
                
                if (!changelog) {
                  try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const changelogResponse = await fetch(`https://www.curseforge.com/api/v1/mods/${projectId}/files/${file.id}/change-log`, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Token': apiToken,
                      },
                    });
                    
                    if (changelogResponse.ok) {
                      const changelogData = await changelogResponse.json();
                      if (changelogData.data) {
                        changelog = typeof changelogData.data === 'string' ? changelogData.data : (changelogData.data.content || changelogData.data.text || changelogData.data.html || changelogData.data.markdown || '');
                        changelogType = changelogData.dataType || (changelogData.data.html ? 'html' : changelogData.data.markdown ? 'markdown' : 'text');
                      }
                    }
                    
                    if (!changelog) {
                      try {
                        const webUrl = `https://www.curseforge.com/minecraft/mc-mods/${projectSlugForWeb}/files/${file.id}/changelog`;
                        const webResponse = await fetch(webUrl, {
                          method: 'GET',
                          headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html',
                          },
                        });
                        
                        if (webResponse.ok) {
                          const html = await webResponse.text();
                          const changelogMatch = html.match(/<div[^>]*class="[^"]*changelog[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                                                 html.match(/<div[^>]*id="[^"]*changelog[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                                                 html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                                                 html.match(/<div[^>]*class="[^"]*markdown[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                          
                          if (changelogMatch && changelogMatch[1]) {
                            changelog = changelogMatch[1].trim();
                            changelogType = 'html';
                          } else {
                            const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
                            if (preMatch && preMatch[1]) {
                              changelog = preMatch[1].trim();
                              changelogType = 'text';
                            }
                          }
                        }
                      } catch (webError) {
                      }
                    }
                  } catch (e) {
                  }
                }
              } catch (e) {
              }
            }
            
            file.changelog = changelog;
            file.changelogType = changelogType;
            return file;
          })
        );
        
        return res.status(200).json({ data: filesWithChangelogs });
      }

      case 'projectInfo': {
        if (!projectSlug) {
          return res.status(400).json({ error: 'Project slug is required' });
        }

        const response = await fetch(`https://www.curseforge.com/api/v1/mods/${projectSlug}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(apiToken && { 'X-Api-Token': apiToken }),
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({ error: 'Project not found' });
          }
          throw new Error(`Failed to fetch project info: ${response.statusText}`);
        }

        const data = await response.json();
        return res.status(200).json(data);
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('=== ERROR in handleCurseForge ===', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch data from CurseForge API' 
    });
  }
}

