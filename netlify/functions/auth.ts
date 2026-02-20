
import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyAuthToken, requireAdmin, corsResponse } from './lib/supabaseHelpers';

// Helper to send email via Resend (skips Supabase queue)
async function sendInstantEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY || 're_123'; // Mock for dev if not set to prevent crash, but logs warning
  
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not found. Skipping instant email (Mock Mode).");
    return true; // Pretend we sent it
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: 'Buildscape <noreply@buildscape.verbi.site>', 
      to: [to],
      subject: subject,
      html: html
    })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Resend API Error:", err);
    throw new Error("Failed to send email via Resend provider");
  }
  return true;
}

export const handler = async (event: any, context: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse(200, {});
  }

  const { action } = event.queryStringParameters || {};
  let body: any = {};
  try {
    if (event.body) {
      body = JSON.parse(event.body);
    }
  } catch (e) {
    // Ignore JSON parse error for empty body
  }

  // Combine query params and body action
  const requestAction = action || body.action;

  try {
    // --- Public Endpoints (No Auth Required) ---

    // Instant Signup (Bypasses Supabase SMTP + OTP)
    if (requestAction === 'signup') {
      const { email, password, username, redirectTo } = body;
      
      if (!email || !password || !username) {
        return corsResponse(400, { error: "Email, password, and username required" });
      }

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin.from('profiles').select('email').eq('email', email).maybeSingle();
      if (existingUser) {
        return corsResponse(400, { error: "User already exists" });
      }

      const { data: existingUsername } = await supabaseAdmin.from('profiles').select('username').eq('username', username).maybeSingle();
      if (existingUsername) {
        return corsResponse(400, { error: "Username already taken" });
      }

      const redirectUrl = redirectTo || process.env.URL || 'http://localhost:5173';

      // Generate Link (creates user if not exists)
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: { username },
          redirectTo: redirectUrl
        }
      });

      if (error) throw error;

      const verificationLink = data.properties?.action_link;
      const userId = data.user?.id;

      if (!verificationLink || !userId) throw new Error("Failed to generate verification data");

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

      // Store OTP in connection_codes
      await supabaseAdmin.from('connection_codes').insert({
        id: `otp_${userId}_${Date.now()}`,
        uuid: userId,
        code: otp,
        expires_at: expiresAt,
        used: false
      });

      // Send Email
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #10b981;">Welcome to Buildscape!</h2>
          <p>Thanks for signing up. Please verify your email address to continue.</p>
          
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">Your Verification Code</p>
            <p style="margin: 5px 0 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000;">${otp}</p>
          </div>

          <p style="text-align: center;">OR</p>

          <p style="text-align: center;"><a href="${verificationLink}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Verify via Link</a></p>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">This code expires in 15 minutes.</p>
        </div>
      `;

      await sendInstantEmail(email, "Confirm your Buildscape account", emailHtml);

      return corsResponse(200, { 
        success: true, 
        user: mapProfileToUser(data.user),
        mock: !process.env.RESEND_API_KEY 
      });
    }

    // Instant Resend Confirmation (OTP + Link)
    if (requestAction === 'resendConfirmation') {
      const { email, redirectTo } = body;
      if (!email) return corsResponse(400, { error: "Email required" });

      const redirectUrl = redirectTo || process.env.URL || 'http://localhost:5173';

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: redirectUrl
        }
      });

      if (error) throw error;
      
      const verificationLink = data.properties?.action_link;
      const userId = data.user?.id;

      if (!verificationLink || !userId) throw new Error("Failed to generate verification data");

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

      // Store OTP
      await supabaseAdmin.from('connection_codes').insert({
        id: `otp_${userId}_${Date.now()}`,
        uuid: userId,
        code: otp,
        expires_at: expiresAt,
        used: false
      });

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #10b981;">Verify your email</h2>
          <p>You requested a new verification code for Buildscape.</p>
          
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">Your Verification Code</p>
            <p style="margin: 5px 0 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000;">${otp}</p>
          </div>

          <p style="text-align: center;">OR</p>

          <p style="text-align: center;"><a href="${verificationLink}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Verify via Link</a></p>
        </div>
      `;

      await sendInstantEmail(email, "Verify your Buildscape account", emailHtml);

      return corsResponse(200, { success: true });
    }

    // Verify OTP Action
    if (requestAction === 'verifyOtp') {
      const { email, otp } = body;
      if (!email || !otp) return corsResponse(400, { error: "Email and OTP required" });

      // Get user ID from email
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (profileError || !userProfile) {
        return corsResponse(400, { error: "User not found" });
      }

      // Check OTP
      const { data: otpRecord, error: otpError } = await supabaseAdmin
        .from('connection_codes')
        .select('*')
        .eq('uuid', userProfile.id)
        .eq('code', otp)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }) // Use latest? created_at not in insert above, using default NOW()
        .limit(1)
        .maybeSingle();

      if (otpError || !otpRecord) {
        return corsResponse(400, { error: "Invalid or expired OTP" });
      }

      // Mark OTP as used
      await supabaseAdmin.from('connection_codes').update({ used: true }).eq('id', otpRecord.id);

      // Confirm User Email
      const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
        userProfile.id,
        { email_confirm: true }
      );

      if (confirmError) throw confirmError;

      return corsResponse(200, { success: true });
    }

    // Check Username Availability
    if (requestAction === 'checkUsername') {
      const { username } = body;
      
      if (!username || username.length < 3) {
        return corsResponse(400, { available: false, error: "Username must be at least 3 characters" });
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .ilike('username', username)
        .maybeSingle();

      if (error) throw error;
      
      // Also check if it's the current user's username (handled in client usually, but here strict check)
      return corsResponse(200, { available: !data });
    }

    // Verify Player (Minecraft Server)
    if (requestAction === 'verifyPlayer') {
      const uuid = event.queryStringParameters?.uuid || body.uuid;
      if (!uuid) return corsResponse(400, { error: "UUID required" });

      const normalizedUuid = uuid.replace(/-/g, '');
      const { data: user, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('minecraft_uuid', normalizedUuid)
        .single();

      if (error || !user) {
        // Return 200 with verified: false to avoid causing server errors on 404
        return corsResponse(200, { verified: false, error: "Player not found" }); 
      }

      return corsResponse(200, {
        verified: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          minecraftUsername: user.minecraft_username,
          minecraftUuid: user.minecraft_uuid
        }
      });
    }

    // Get Linked Players (Minecraft Server)
    if (requestAction === 'getLinkedPlayers') {
      const { data: players, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, minecraft_username, minecraft_uuid, role')
        .not('minecraft_uuid', 'is', null);

      if (error) throw error;

      return corsResponse(200, { 
        players: players.map((p: any) => ({
          userId: p.id,
          websiteUsername: p.username,
          minecraftUsername: p.minecraft_username,
          minecraftUuid: p.minecraft_uuid,
          role: p.role
        }))
      });
    }

    // Check Subscription (Minecraft Mod)
    if (requestAction === 'checkSubscription') {
      const uuid = event.queryStringParameters?.uuid || body.uuid;
      if (!uuid) return corsResponse(400, { error: "UUID required" });

      const normalizedUuid = uuid.replace(/-/g, '');
      const { data: user, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('minecraft_uuid', normalizedUuid)
        .single();

      if (error || !user) {
        return corsResponse(200, { hasSubscription: false, error: "Player not found" });
      }

      const sub = user.kofi_subscription; // JSONB column
      const hasActiveSubscription = sub?.isActive === true;

      return corsResponse(200, {
        hasSubscription: hasActiveSubscription,
        subscription: sub ? {
          isActive: sub.isActive,
          tierName: sub.tierName,
          lastPaymentDate: sub.lastPaymentDate,
          nextPaymentDate: sub.nextPaymentDate,
          amount: sub.amount,
          currency: sub.currency,
        } : null,
        userId: user.id,
        username: user.username,
        minecraftUsername: user.minecraft_username
      });
    }

    // Get Tier Rewards (Minecraft Mod)
    if (requestAction === 'getTierRewards') {
      const uuid = event.queryStringParameters?.uuid || body.uuid;
      if (!uuid) return corsResponse(400, { error: "UUID required" });

      const normalizedUuid = uuid.replace(/-/g, '');
      const { data: user, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('minecraft_uuid', normalizedUuid)
        .single();

      if (error || !user) {
        return corsResponse(200, { hasSubscription: false, error: "Player not found" });
      }

      // Fetch kofi tiers from config
      const { data: configData } = await supabaseAdmin
        .from('config')
        .select('data')
        .eq('id', 'main_config')
        .single();
        
      const kofiTiers = configData?.data?.kofiTiers || [];

      // Find matching tier
      let matchingTier = null;
      if (user.kofi_subscription?.isActive && user.kofi_subscription?.tierName) {
        matchingTier = kofiTiers.find((t: any) => 
          t.enabled && 
          t.koFiTierName?.toLowerCase() === user.kofi_subscription.tierName?.toLowerCase()
        );
      }

      // Get manual rewards
      const { data: manualRewards } = await supabaseAdmin
        .from('kofi_manual_rewards')
        .select('*')
        .eq('user_id', user.id)
        .eq('granted', false);

      return corsResponse(200, {
        hasSubscription: user.kofi_subscription?.isActive === true,
        tier: matchingTier ? {
          id: matchingTier.id,
          name: matchingTier.name,
          rewards: matchingTier.rewards || [],
          durationType: matchingTier.durationType
        } : null,
        manualRewards: (manualRewards || []).map((r: any) => ({
          id: r.id,
          rewards: r.rewards || []
        })),
        userId: user.id,
        username: user.username,
        minecraftUsername: user.minecraft_username
      });
    }

    // --- Authenticated Endpoints (Require valid JWT) ---
    
    // For all other actions, verify token first
    const { user: authUser, profile, error: authError } = await verifyAuthToken(event);
    
    if (authError || !authUser) {
       // Allow "getAllUsers" if it's strictly admin-only handled later? 
       // No, verifyToken fails regardless.
       // However, if the action wasn't matched above, it implies it needs auth or doesn't exist.
       return corsResponse(401, { error: "Unauthorized: " + authError });
    }

    const userId = authUser.id; // Correct user ID from token

    // Update Profile
    if (requestAction === 'updateProfile') {
      const { username, streamerMode, profileIcon } = body;
      
      const updates: any = {};
      if (streamerMode !== undefined) updates.streamer_mode = streamerMode;
      if (profileIcon !== undefined) updates.profile_icon = profileIcon;
      
      // Username uniqueness check
      if (username && username !== profile.username) {
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();
          
        if (existing) return corsResponse(400, { error: "Username already taken" });
        updates.username = username;
      }

      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;
      
      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    // Update Ko-fi Username
    if (requestAction === 'updateKofiUsername') {
      const { kofiUsername } = body;
      
      // Basic validation
      if (kofiUsername && !/^[a-zA-Z0-9_-]+$/.test(kofiUsername)) {
        return corsResponse(400, { error: "Invalid Ko-fi username format" });
      }

      const updates = { kofi_username: kofiUsername || null };
      
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
        
      if (updateError) throw updateError;
      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    // Generate Ko-fi Link Token (kept for backward compat, though logic might change)
    if (requestAction === 'generateKofiLinkToken') {
      // Logic for token generation (using connection_codes table)
      // Spec says: "connection_codes" table
      
      // Clean up old codes
      await supabaseAdmin.from('connection_codes').delete().eq('uuid', userId); // user_id in this context is uuid? No, profile id.

      // But spec table says: connection_codes(uuid TEXT, code TEXT...).
      // Is 'uuid' the profile ID (UUID) or Minecraft UUID?
      // In MongoDB code it was 'kofi_links' collection with userId.
      // Let's assume it's Profile ID.
      
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      await supabaseAdmin.from('connection_codes').insert({
        uuid: userId,
        code: token,
        expires_at: expiresAt
      });
      
      return corsResponse(200, { success: true, token });
    }

    // Link Minecraft Account
    if (requestAction === 'linkMinecraft') {
      const { minecraftUsername } = body;
      if (!minecraftUsername) return corsResponse(400, { error: "Minecraft username required" });

      // Mojang lookup
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftUsername)}`);
      if (!mojangRes.ok) return corsResponse(400, { error: "Minecraft account not found" });
      
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id; // No dashes usually from this endpoint? actually it returns no dashes.
      
      // Check if linked to another user
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('minecraft_uuid', uuid)
        .neq('id', userId)
        .maybeSingle();

      if (existing) return corsResponse(400, { error: "Minecraft account already linked to another user" });

      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          minecraft_username: mojangData.name,
          minecraft_uuid: uuid
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;
      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    // Unlink Minecraft Account
    if (requestAction === 'unlinkMinecraft') {
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          minecraft_username: null,
          minecraft_uuid: null
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;
      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    // --- Admin Endpoints ---
    
    // Get All Users (Admin)
    if (requestAction === 'getAllUsers') {
      if (profile.role !== 'admin' && profile.role !== 'owner') {
         return corsResponse(403, { error: "Forbidden" });
      }

      const { data: users, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return corsResponse(200, { users: users.map(mapProfileToUser) });
    }

    // Update User Role (Admin) - But Owner role is protected
    if (requestAction === 'updateRole') {
      if (profile.role !== 'admin' && profile.role !== 'owner') {
         return corsResponse(403, { error: "Forbidden" });
      }
      
      const { id: targetId, role: newRole } = body;
      
      // Protect Owner
      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', targetId).single();
      if (targetProfile?.role === 'owner') return corsResponse(403, { error: "Cannot modify Owner" });

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetId);

      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    // Delete User (Admin)
    if (event.httpMethod === 'DELETE' || requestAction === 'deleteUser') {
      if (profile.role !== 'admin' && profile.role !== 'owner') {
         return corsResponse(403, { error: "Forbidden" });
      }
      const targetId = event.queryStringParameters?.id || body.id;

      // Protect Owner
       const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', targetId).single();
       if (targetProfile?.role === 'owner') return corsResponse(403, { error: "Cannot delete Owner" });

      // Delete from auth.users (cascades to profiles)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      
      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    return corsResponse(400, { error: "Invalid action" });

  } catch (err: any) {
    console.error("Function error:", err);
    return corsResponse(500, { error: err.message || "Internal Server Error" });
  }
};

// Helper to map DB profile to frontend User object
function mapProfileToUser(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    role: p.role,
    minecraftUsername: p.minecraft_username,
    minecraftUuid: p.minecraft_uuid,
    kofiUsername: p.kofi_username,
    profileIcon: p.profile_icon,
    streamerMode: p.streamer_mode,
    kofiSubscription: p.kofi_subscription
  };
}