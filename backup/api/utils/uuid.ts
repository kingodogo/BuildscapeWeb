// UUID validation utility

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return UUID_REGEX.test(uuid.trim());
}

export function validateUUID(uuid: string | undefined): { valid: boolean; error?: string } {
  if (!uuid) {
    return { valid: false, error: 'UUID is required' };
  }
  
  if (!isValidUUID(uuid)) {
    return { valid: false, error: 'Invalid UUID format' };
  }
  
  return { valid: true };
}

// Extract UUID from Vercel request (query param, catch-all route, or URL path)
export function extractUUID(req: any): string | undefined {
  // Try query parameter first
  if (req.query?.uuid) {
    const uuidParam = Array.isArray(req.query.uuid) ? req.query.uuid[0] : req.query.uuid;
    if (uuidParam && isValidUUID(uuidParam)) {
      return uuidParam;
    }
  }
  
  // Try catch-all route parameter (Vercel puts path segments in query with the param name)
  // For routes like [...uuid], Vercel uses the param name as the key
  const catchAllKeys = Object.keys(req.query || {}).filter(key => 
    key.includes('uuid') || key.includes('slug') || key.includes('param')
  );
  for (const key of catchAllKeys) {
    const value = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
    if (value && isValidUUID(value)) {
      return value;
    }
  }
  
  // Try to extract from URL path
  if (req.url && typeof req.url === 'string') {
    try {
      const host = req.headers?.host || 'localhost';
      const baseUrl = typeof host === 'string' ? `http://${host}` : 'http://localhost';
      const url = new URL(req.url, baseUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Look for UUID pattern in path parts
      for (const part of pathParts) {
        if (isValidUUID(part)) {
          return part;
        }
      }
    } catch (e) {
      // URL parsing failed, try direct path extraction
      if (typeof req.url === 'string') {
        const pathMatch = req.url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (pathMatch && pathMatch[1]) {
          return pathMatch[1];
        }
      }
    }
  }
  
  return undefined;
}

