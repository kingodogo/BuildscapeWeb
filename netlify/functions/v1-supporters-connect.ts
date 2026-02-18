
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  // Allow GET to verify code? Or POST to link?
  // Usually this endpoint validates a connection code from Minecraft client
  
  const { code, uuid } = event.queryStringParameters || {};
  let body: any = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {}
  
  const requestUuid = uuid || body.uuid;
  const requestCode = code || body.code;

  if (!requestUuid || !requestCode) {
      return corsResponse(400, { error: 'UUID and code required' });
  }

  const normalizedUuid = requestUuid.replace(/-/g, '');

  try {
      // Logic: Validate connection code
      // Check `connection_codes` table
      const { data: validCode, error } = await supabaseAdmin
          .from('connection_codes')
          .select('*')
          .eq('code', requestCode)
          .single();

      if (error || !validCode) {
          return corsResponse(404, { error: 'Invalid or expired code', valid: false });
      }

      // Check expiry
      if (new Date(validCode.expires_at).getTime() < Date.now()) {
          return corsResponse(400, { error: 'Code expired', valid: false });
      }

      // If valid, return success and potentially the linked user ID?
      // Or link here?
      // Spec: "v1-supporters-connect".
      // Usually used by plugin to check if code is valid and get user info.
      // Or used by web to check if code from MC is valid.
      // Assuming it returns validity and user_id.

      // If code was generated for a user (web -> mc), `uuid` in table is profile ID.
      // If code was generated for MC (mc -> web), `uuid` in table is MC UUID.
      // Typically `generateKofiLinkToken` generates code for User ID.
      // So `validCode.uuid` is the User Profile ID.
      
      // We return the profile ID so MC mod knows which user this is.
      return corsResponse(200, { 
          valid: true, 
          userId: validCode.uuid, 
          message: 'Connection successful' 
      });

  } catch (error: any) {
      console.error("Connect API Error:", error);
      return corsResponse(500, { error: error.message });
  }
};
