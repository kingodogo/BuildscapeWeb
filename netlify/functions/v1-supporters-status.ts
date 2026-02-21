
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  const { uuid } = event.queryStringParameters || {};
  if (!uuid) return corsResponse(400, { error: 'UUID required' });

  const normalizedUuid = uuid.replace(/-/g, '');

  try {
      // Check profile for subscription
      const { data: user, error } = await supabaseAdmin
          .from('profiles')
          .select('id, username, role, kofi_subscription, minecraft_username')
          .eq('minecraft_uuid', normalizedUuid)
          .single();

      if (error || !user) {
          return corsResponse(200, { 
              active: false, 
              message: 'User not found or not linked' 
          });
      }

      const sub = user.kofi_subscription;
      const isAdmin = user.role === 'admin' || user.role === 'owner';
      const isActive = (sub?.isActive === true) || isAdmin;

      return corsResponse(200, {
          active: isActive,
          isAdmin,
          tier: isAdmin ? 'Admin' : (sub?.tierName || null),
          username: user.username,
          minecraft_username: user.minecraft_username,
          subscription: sub
      });

  } catch (error: any) {
      console.error("Supporters Status API Error:", error);
      return corsResponse(500, { error: error.message });
  }
};
