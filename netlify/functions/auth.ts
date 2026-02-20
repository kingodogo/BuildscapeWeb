import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyAuthToken, requireAdmin, corsResponse } from './lib/supabaseHelpers';

import nodemailer from 'nodemailer';

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper to send professional HTML email
async function sendProfessionalEmail(to: string, subject: string, title: string, message: string, buttonText: string, buttonLink: string, otp?: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        body { margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e5e7eb; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #0a0a0a; padding-bottom: 60px; padding-top: 60px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #111111; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
        .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase; }
        .content { padding: 48px 40px; text-align: center; }
        .title { font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #ffffff; letter-spacing: -0.025em; }
        .message { font-size: 16px; line-height: 1.6; color: #9ca3af; margin-bottom: 32px; font-weight: 400; }
        .otp-container { background-color: #171717; border: 1px dashed #374151; border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center; }
        .otp-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 12px; }
        .otp-code { font-size: 40px; font-weight: 800; letter-spacing: 0.2em; color: #10b981; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", font-family: monospace; }
        .button { display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; transition: all 0.2s ease; margin-top: 8px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2); }
        .footer { padding: 32px; text-align: center; font-size: 13px; color: #4b5563; border-top: 1px solid #1f2937; }
        .footer a { color: #10b981; text-decoration: none; font-weight: 500; }
        .divider { margin: 40px 0; height: 1px; background-color: #1f2937; position: relative; }
        .divider span { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background-color: #111111; padding: 0 16px; color: #4b5563; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .link-text { margin-top: 24px; font-size: 12px; color: #4b5563; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>Buildscape</h1>
          </div>
          <div class="content">
            <div class="title">${title}</div>
            <div class="message">${message}</div>
            
            ${otp ? `
            <div class="otp-container">
              <div class="otp-label">Direct Verification Code</div>
              <div class="otp-code">${otp}</div>
            </div>
            ` : ''}

            ${buttonLink ? `
              ${otp ? '<div class="divider"><span>OR</span></div>' : ''}
              <a href="${buttonLink}" class="button">${buttonText}</a>
              <div class="link-text">
                Button not working? Copy this link:<br>
                <a href="${buttonLink}" style="color: #10b981;">${buttonLink}</a>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Buildscape Tracker. All rights reserved.<br>
            Sent with &hearts; to ${to}<br>
            <p>If you didn't request this email, you can safely ignore it.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`Attempting to send email via Resend to ${to}...`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Buildscape <noreply@buildscape.verbi.site>', 
          to: [to],
          subject: subject,
          html: html
        })
      });

      if (res.ok) {
        console.log("Email sent successfully via Resend.");
        return true;
      }
      const errData = await res.json();
      console.warn("Resend API failed:", errData, "Falling back to SMTP...");
    } catch (e) {
      console.warn("Resend API error:", e, "Falling back to SMTP...");
    }
  }

  // Fallback to SMTP (Nodemailer)
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn("SMTP credentials missing and Resend failed. Cannot send email.");
      throw new Error("Email service not configured (check SMTP_HOST, SMTP_USER, SMTP_PASS in .env)");
    }

    const fromName = process.env.SMTP_FROM_NAME || 'Buildscape Support';
    const fromEmail = process.env.SMTP_FROM || smtpUser;

    console.log(`Attempting to send professional email via SMTP (${smtpHost}:${smtpPort}) to ${to}...`);
    
    const mailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // Zoho/Outlook fix: ensure the sender matches exactly
      tls: {
          rejectUnauthorized: false
      }
    });

    await mailTransporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    
    console.log("Email sent successfully via SMTP.");
    return true;
  } catch (error: any) {
    console.error("Critical Email Error:", error);
    throw new Error(`Email delivery failed: ${error.message}. Please check your SMTP settings.`);
  }
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
    // Ignore JSON parse error
  }

    // Combine query params and body action
    const requestAction = action || body.action;

    try {
        // --- Public Endpoints ---

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

    // Verify Player With Code (Public endpoint for Minecraft Server)
    if (requestAction === 'verifyPlayerWithCode') {
      const { code, uuid } = body;
      if (!code || !uuid) return corsResponse(400, { error: "Code and UUID required" });

      // Find the code record
      // We search all records because this is a public verification from the server
      const { data: record, error: findError } = await supabaseAdmin
        .from('connection_codes')
        .select('*')
        .like('code', `MC-%:${uuid}:%`)
        .single();

      if (findError || !record) return corsResponse(400, { error: "Invalid or expired linking code for this UUID" });

      // Check expiration
      if (new Date(record.expires_at) < new Date()) {
        await supabaseAdmin.from('connection_codes').delete().eq('id', record.id);
        return corsResponse(400, { error: "Linking code expired" });
      }

      // Check code matching
      const parts = record.code.split(':');
      const submittedCodeOnly = code.startsWith('MC-') ? code : `MC-${code}`;
      
      if (parts[0] !== submittedCodeOnly) {
        return corsResponse(400, { error: "Incorrect linking code" });
      }

      const mUuid = parts[1];
      const mName = parts[2];

      // Found the user (record.uuid is the profile ID)
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          minecraft_username: mName,
          minecraft_uuid: mUuid
        })
        .eq('id', record.uuid)
        .select()
        .single();

      if (updateError) throw updateError;

      // Clean up code
      await supabaseAdmin.from('connection_codes').delete().eq('id', record.id);

      return corsResponse(200, { 
        success: true, 
        username: updatedProfile.username,
        minecraft_username: mName 
      });
    }

    // Verify User Session (Public check but typically used after login)
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

    // Generate Ko-fi Link Token
    if (requestAction === 'generateKofiLinkToken') {
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      await supabaseAdmin.from('connection_codes').delete().eq('uuid', userId);
      await supabaseAdmin.from('connection_codes').insert({
        uuid: userId,
        code: token,
        expires_at: expiresAt
      });
      
      return corsResponse(200, { success: true, token });
    }

    // Request Minecraft Linking Code
    if (requestAction === 'requestMinecraftCode') {
      const { minecraftUsername } = body;
      if (!minecraftUsername) return corsResponse(400, { error: "Minecraft username required" });

      // Mojang lookup
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftUsername)}`);
      if (!mojangRes.ok) return corsResponse(400, { error: "Minecraft account not found" });
      
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;

      // Check if linked to another user
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('minecraft_uuid', uuid)
        .neq('id', userId)
        .maybeSingle();

      if (existing) return corsResponse(400, { error: "Minecraft account already linked to another user" });

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

      // Store in connection_codes (reusing the table)
      // Since 'uuid' column in this table is used for UserID, we'll store the code there.
      // We'll use a prefix or metadata if we had it, but for now we'll just store and manage it.
      // We'll delete any existing codes for this user first
      await supabaseAdmin.from('connection_codes').delete().eq('uuid', userId);
      
      await supabaseAdmin.from('connection_codes').insert({
        uuid: userId,
        code: `MC-${code}:${uuid}:${mojangData.name}`, // Store UUID and name in the code string for easy retrieval
        expires_at: expiresAt
      });

      return corsResponse(200, { success: true, code: `MC-${code}`, mojangName: mojangData.name });
    }

    // Confirm Minecraft Link (Public endpoint for mod/server or user)
    if (requestAction === 'confirmMinecraftLink') {
      const { code } = body; // The code the user entered on the website
      if (!code) return corsResponse(400, { error: "Code required" });

      // Find the code record
      const { data: record, error: findError } = await supabaseAdmin
        .from('connection_codes')
        .select('*')
        .eq('uuid', userId)
        .like('code', `MC-%`)
        .single();

      if (findError || !record) return corsResponse(400, { error: "Invalid or expired linking code" });

      // Check expiration
      if (new Date(record.expires_at) < new Date()) {
        await supabaseAdmin.from('connection_codes').delete().eq('id', record.id);
        return corsResponse(400, { error: "Linking code expired" });
      }

      // Format is MC-123456:uuid:username
      const parts = record.code.split(':');
      const submittedCodeOnly = code.startsWith('MC-') ? code : `MC-${code}`;
      
      if (parts[0] !== submittedCodeOnly) {
        return corsResponse(400, { error: "Incorrect linking code" });
      }

      const mUuid = parts[1];
      const mName = parts[2];

      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          minecraft_username: mName,
          minecraft_uuid: mUuid
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Clean up code
      await supabaseAdmin.from('connection_codes').delete().eq('id', record.id);

      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
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