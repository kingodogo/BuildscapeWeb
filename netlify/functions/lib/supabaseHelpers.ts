import { supabaseAdmin } from './supabaseAdmin';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust based on env if needed
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE'
};

export const corsResponse = (statusCode: number, body: any) => {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
};

export const verifyAuthToken = async (event: any) => {
  // Normalize all headers to look for authorization case-insensitively
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || 
                    Object.keys(headers).find(k => k.toLowerCase() === 'authorization') ? headers[Object.keys(headers).find(k => k.toLowerCase() === 'authorization')!] : null;
  
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }
  
  // Get profile to check role
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  return { user, profile, error: null };
};

export const requireAdmin = async (event: any) => {
  const { user, profile, error } = await verifyAuthToken(event);
  
  if (error || !user) {
    return { authorized: false, response: corsResponse(401, { error: error || 'Unauthorized' }) };
  }
  
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    return { authorized: false, response: corsResponse(403, { error: 'Forbidden: Admin access required' }) };
  }
  
  return { authorized: true, user, profile };
};