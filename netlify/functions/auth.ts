import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyAuthToken, requireAdmin, corsResponse } from './lib/supabaseHelpers';
import { getMicrosoftLoginUrl, getMinecraftProfileFromCode } from './lib/msAuth';
import { getTwitchLoginUrl, getTwitchProfileFromCode } from './lib/twitchAuth';

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

// Helper to escape HTML characters to prevent XSS in emails
function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper to send professional HTML email
async function sendProfessionalEmail(to: string, subject: string, title: string, message: string, buttonText: string, buttonLink: string, otp?: string) {
  // Sanitize and escape all user-controlled values
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeOtp = otp ? escapeHtml(otp) : '';
  const safeTo = escapeHtml(to);
  const safeButtonText = escapeHtml(buttonText);
  const safeSubject = escapeHtml(subject);
  
  // Validate button link protocol (only allow http/https)
  let safeButtonLink = "";
  if (buttonLink && (buttonLink.startsWith("http://") || buttonLink.startsWith("https://"))) {
      safeButtonLink = buttonLink; // We assume the link itself is properly formatted for interpolation
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${safeSubject}</title>
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
            <div class="title">${safeTitle}</div>
            <div class="message">${safeMessage}</div>
            
            ${safeOtp ? `
            <div class="otp-container">
              <div class="otp-label">Direct Verification Code</div>
              <div class="otp-code">${safeOtp}</div>
            </div>
            ` : ''}
 
            ${safeButtonLink ? `
              ${safeOtp ? '<div class="divider"><span>OR</span></div>' : ''}
              <a href="${safeButtonLink}" class="button">${safeButtonText}</a>
              <div class="link-text">
                Button not working? Copy this link:<br>
                <a href="${safeButtonLink}" style="color: #10b981;">${safeButtonLink}</a>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Buildscape Tracker. All rights reserved.<br>
            Sent with &hearts; to ${safeTo}<br>
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

    // ── Legacy Migration Step 1 (PUBLIC — user not logged in yet) ─────────────
    if (requestAction === 'initiateLegacyMigration') {
      const { identifier } = body;
      if (!identifier) return corsResponse(400, { error: "Identifier or Username required" });

      const isEmail = identifier.includes('@');
      const q = supabaseAdmin.from('legacy_users').select('*');
      const { data: legacy, error: legacyError } = isEmail
        ? await q.eq('email', identifier.toLowerCase()).maybeSingle()
        : await q.ilike('username', identifier).maybeSingle();

      if (legacyError) throw legacyError;
      if (!legacy) return corsResponse(404, { error: "No legacy account found for this info. If you are new, please Register normally." });

      // Trigger OTP send server-side. signInWithOtp handles creation if missing.
      const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({ 
        email: legacy.email,
        options: {
          shouldCreateUser: true,
          data: { username: legacy.username }
        }
      });
      
      if (otpError) {
        console.error("Migration OTP error:", otpError);
        return corsResponse(500, { error: "Failed to send verification code. " + otpError.message });
      }

      const parts = legacy.email.split('@');
      const maskedEmail = parts[0].length > 2 
        ? parts[0].slice(0, 2) + '*'.repeat(parts[0].length - 2) + '@' + parts[1]
        : '***@' + parts[1];

      return corsResponse(200, { success: true, maskedEmail, username: legacy.username });
    }

    // --- Authenticated Endpoints (Require valid JWT) ---
    
    // For all other actions, verify token first
    const { user: authUser, profile, error: authError } = await verifyAuthToken(event);
    
    if (authError || !authUser) {
       return corsResponse(401, { error: "Unauthorized: " + authError });
    }

    const userId = authUser.id; // Correct user ID from token
    const userRole = profile?.role?.toLowerCase() || 'user';
    const isAdmin = userRole === 'admin' || userRole === 'owner';

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

      // Handle clearing forced password reset flag if provided
      // This is usually done client-side during reset, but we support it here for consistency
      let forceResetFlag = false;
      if (body.forcePasswordReset === false) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { force_password_reset: false }
        });
        forceResetFlag = false;
      } else {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
        forceResetFlag = !!user?.user_metadata?.force_password_reset;
      }
      
      return corsResponse(200, { 
        success: true, 
        user: { ...mapProfileToUser(updatedProfile), forcePasswordReset: forceResetFlag } 
      });
    }

    // Update Ko-fi Username & Claim past rewards
    if (requestAction === 'updateKofiUsername') {
      const { kofiUsername } = body;
      
      if (kofiUsername && !/^[a-zA-Z0-9 \._-]+$/.test(kofiUsername)) {
        return corsResponse(400, { error: "Invalid Ko-fi username format" });
      }

      const updates: any = { kofi_username: kofiUsername || null };
      
      if (kofiUsername) {
        // Find unclaimed payments for this name
        const { data: pastPayments } = await supabaseAdmin
          .from('kofi_payments')
          .select('*')
          .ilike('kofi_username', kofiUsername)
          .is('user_id', null)
          .order('timestamp', { ascending: false });

        if (pastPayments && pastPayments.length > 0) {
          // Link them
          await supabaseAdmin
            .from('kofi_payments')
            .update({ user_id: userId })
            .ilike('kofi_username', kofiUsername)
            .is('user_id', null);

          // Check for active subscription among these
          const latestSub = pastPayments.find((p: any) => p.is_subscription);
          if (latestSub) {
            const d = new Date(latestSub.timestamp);
            d.setMonth(d.getMonth() + 1);
            
            updates.kofi_subscription = {
              isActive: true, // Assuming it's still active if found or just reactivation
              tierName: latestSub.tier_name,
              lastPaymentDate: latestSub.timestamp,
              nextPaymentDate: d.getTime(),
              amount: latestSub.amount,
              currency: latestSub.currency,
              kofiTransactionId: latestSub.kofi_transaction_id
            };
          }
        }
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


    // Link Minecraft Account
    if (requestAction === 'linkMinecraft') {
      const { minecraftUsername } = body;
      if (!minecraftUsername) return corsResponse(400, { error: "Minecraft username required" });

      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftUsername)}`);
      if (!mojangRes.ok) return corsResponse(400, { error: "Minecraft account not found" });
      
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;
      
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
      
      await syncMinecraftRewards(userId, uuid);

      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    // --- Minecraft & Twitch OAuth ---
    
    if (requestAction === 'getMinecraftLoginUrl') {
      const { redirectUri } = body;
      if (!redirectUri) return corsResponse(400, { error: "Redirect URI required" });
      try {
        const url = getMicrosoftLoginUrl(redirectUri);
        return corsResponse(200, { url });
      } catch (e: any) { return corsResponse(500, { error: e.message }); }
    }

    if (requestAction === 'linkMinecraftOAuth') {
      const { code, redirectUri } = body;
      if (!code || !redirectUri) return corsResponse(400, { error: "Code and Redirect URI required" });
      
      try {
        const mcProfile = await getMinecraftProfileFromCode(code, redirectUri);
        const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('minecraft_uuid', mcProfile.id).neq('id', userId).maybeSingle();
        if (existing) return corsResponse(400, { error: "Minecraft account already linked to another user" });

        const { data: updatedProfile, error: updateError } = await supabaseAdmin.from('profiles').update({ minecraft_username: mcProfile.name, minecraft_uuid: mcProfile.id }).eq('id', userId).select().single();
        if (updateError) throw updateError;
        await syncMinecraftRewards(userId, mcProfile.id);
        return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
      } catch (e: any) { return corsResponse(400, { error: e.message || 'Failed to link Minecraft account via Microsoft' }); }
    }

    if (requestAction === 'getTwitchLoginUrl') {
        const { redirectUri } = body;
        if (!redirectUri) return corsResponse(400, { error: "Redirect URI required" });
        try { return corsResponse(200, { url: getTwitchLoginUrl(redirectUri) }); } catch (e: any) { return corsResponse(500, { error: e.message }); }
    }

    if (requestAction === 'linkTwitchOAuth') {
        const { code, redirectUri } = body;
        if (!code || !redirectUri) return corsResponse(400, { error: "Code and Redirect URI required" });

        try {
            const twitchProfile = await getTwitchProfileFromCode(code, redirectUri);
            
            const twitchUsername = twitchProfile.login;

            const { data: updatedProfile, error: updateError } = await supabaseAdmin.from('profiles').update({ twitch_username: twitchUsername, twitch_id: twitchProfile.id }).eq('id', userId).select().single();
            if (updateError) throw updateError;
            return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
        } catch (e: any) { return corsResponse(400, { error: e.message || 'Failed to link Twitch account' }); }
    }

    if (requestAction === 'unlinkTwitch') {
        const { data: updatedProfile, error: updateError } = await supabaseAdmin.from('profiles').update({ twitch_username: null, twitch_subscription_data: null }).eq('id', userId).select().single();
        if (updateError) throw updateError;
        return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    if (requestAction === 'unlinkMinecraft') {
      const { data: updatedProfile, error: updateError } = await supabaseAdmin.from('profiles').update({ minecraft_username: null, minecraft_uuid: null }).eq('id', userId).select().single();
      if (updateError) throw updateError;
      return corsResponse(200, { success: true, user: mapProfileToUser(updatedProfile) });
    }

    // --- Admin Endpoints ---
    
    if (requestAction === 'getAllUsers') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const { data: users, error } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return corsResponse(200, { users: users.map(mapProfileToUser) });
    }

    if (requestAction === 'getLegacyUsers') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const { data: users, error } = await supabaseAdmin.from('legacy_users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return corsResponse(200, { 
        users: (users || []).map(u => ({
          email: u.email,
          username: u.username,
          role: u.old_role,
          minecraftUsername: u.old_minecraft_username,
          minecraftUuid: u.old_minecraft_uuid,
          kofiUsername: u.old_kofi_username,
          createdAt: new Date(u.created_at).getTime()
        }))
      });
    }

    if (requestAction === 'deleteLegacyUser') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const targetEmail = body.email;
      if (!targetEmail) return corsResponse(400, { error: "Email required" });
      const { error } = await supabaseAdmin.from('legacy_users').delete().eq('email', targetEmail);
      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    if (requestAction === 'createLegacyUser') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const { user } = body;
      if (!user || !user.email || !user.username) return corsResponse(400, { error: "Email and username required" });
      const { error } = await supabaseAdmin.from('legacy_users').insert({
          email: user.email.toLowerCase(),
          username: user.username,
          old_role: user.role || 'user',
          old_minecraft_username: user.minecraftUsername || null,
          old_minecraft_uuid: user.minecraftUuid || null,
          old_kofi_username: user.kofiUsername || null
        });
      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    if (requestAction === 'sendResetLink') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const { id: targetId } = body;
      if (!targetId) return corsResponse(400, { error: "User ID required" });

      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('email, username').eq('id', targetId).single();
      if (!targetProfile) return corsResponse(404, { error: "User not found" });

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetProfile.email,
        options: { redirectTo: process.env.URL ? `${process.env.URL}/reset-password` : 'http://localhost:8888/reset-password' }
      });

      if (error) throw error;

      let emailSent = false;
      let emailError = null;
      try {
        await sendProfessionalEmail(
          targetProfile.email,
          "Reset Your Password - Buildscape",
          "Password Reset Requested",
          `Hi ${targetProfile.username}, an administrator has initiated a password reset for your account. Please check your email for the reset link or click the button below.`,
          "Reset Password",
          data.properties.action_link
        );
        emailSent = true;
      } catch (e: any) {
        console.error("Failed to send reset link email:", e);
        emailError = e.message;
      }

      return corsResponse(200, { 
        success: true, 
        emailSent, 
        emailError
        // recoveryLink removed for SECURITY: admin shouldn't be able to bypass user's email access
      });
    }

    if (requestAction === 'forceResetPassword') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const { id: targetId } = body;
      if (!targetId) return corsResponse(400, { error: "User ID required" });

      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('email, username').eq('id', targetId).single();
      if (!targetProfile) return corsResponse(404, { error: "User not found" });

      // Generate random dummy password
      const dummyPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
        password: dummyPassword,
        user_metadata: { force_password_reset: true }
      });

      if (error) throw error;

      let emailSent = false;
      let emailError = null;

      try {
        await sendProfessionalEmail(
          targetProfile.email,
          "Temporary Password Assigned - Buildscape",
          "New Temporary Password",
          `Hi ${targetProfile.username}, your password has been reset by an administrator. \n\nYour temporary password is: **${dummyPassword}**\n\nPlease log in and change your password immediately.`,
          "Login Now",
          process.env.URL || 'http://localhost:8888',
          dummyPassword
        );
        emailSent = true;
      } catch (e: any) {
        console.error("Failed to send force reset email:", e);
        emailError = e.message;
      }

      return corsResponse(200, { 
        success: true, 
        emailSent, 
        emailError
        // dummyPassword removed for SECURITY: admin shouldn't see the password directly
      });
    }

    // Update User Role (Admin) - But Owner role is protected
    if (requestAction === 'updateRole') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      
      const { id: targetId, role: newRole } = body;
      
      // Protect Owner
      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', targetId).single();
      if (targetProfile?.role?.toLowerCase() === 'owner') return corsResponse(403, { error: "Cannot modify Owner" });

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetId);

      if (error) throw error;
      return corsResponse(200, { success: true });
    }

    // Delete User (Admin)
    if (event.httpMethod === 'DELETE' || requestAction === 'deleteUser') {
      if (!isAdmin) return corsResponse(403, { error: "Forbidden" });
      const targetId = event.queryStringParameters?.id || body.id;

       // Protect Owner
       const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', targetId).single();
       if (targetProfile?.role?.toLowerCase() === 'owner') return corsResponse(403, { error: "Cannot delete Owner" });

      // Delete from auth.users (cascades to profiles)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      
      if (error) throw error;
      return corsResponse(200, { success: true });
    }


    // ── Legacy Migration Step 2 (PROTECTED — user authenticated via Supabase OTP) ───
    if (requestAction === 'finalizeLegacyProfile') {
      // authUser is already verified by verifyAuthToken above
      const userEmail = authUser.email!.toLowerCase();
      
      const { data: legacy } = await supabaseAdmin
        .from('legacy_users')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (!legacy) {
        // Double check if profile already exists (maybe they hit refresh or double clicked)
        const { data: existingProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
        if (existingProfile) return corsResponse(200, { success: true, user: mapProfileToUser(existingProfile), message: "Profile already restored" });
        
        return corsResponse(404, { error: "No legacy data found for this account. It may have been already migrated." });
      }

      const { data: restoredProfile, error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authUser.id,
          username: legacy.username,
          email: legacy.email,
          role: legacy.old_role || 'user',
          minecraft_username: legacy.old_minecraft_username || null,
          minecraft_uuid: legacy.old_minecraft_uuid || null,
          kofi_username: legacy.old_kofi_username || null,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      // Cleanup: Delete from legacy_users now that they are fully migrated
      await supabaseAdmin.from('legacy_users').delete().eq('email', userEmail);
      
      console.log(`Migration complete for ${userEmail}`);
      return corsResponse(200, { success: true, user: mapProfileToUser(restoredProfile) });
    }


    return corsResponse(400, { error: "Invalid action" });


  } catch (err: any) {
    console.error("Function error:", err);
    // Suppress redundant error objects if it's already a Supabase error
    const msg = err.error_description || err.message || "Internal Server Error";
    return corsResponse(500, { error: msg });
  }
};

// Helper to sync rewards to Minecraft UUID
async function syncMinecraftRewards(userId: string, mUuid: string) {
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('kofi_subscription').eq('id', userId).single();
    if (profile?.kofi_subscription?.isActive && profile.kofi_subscription.tierName) {
      // Use config kofiTiers instead ofsupport_tiers table for consistency
      const { data: configRes } = await supabaseAdmin.from('config').select('data').eq('id', 'main_config').maybeSingle();
      const config = configRes?.data;
      
      const tier = config?.kofiTiers?.find((t: any) => 
        t.enabled && (t.koFiTierName?.toLowerCase() === profile.kofi_subscription.tierName.toLowerCase() || t.name?.toLowerCase() === profile.kofi_subscription.tierName.toLowerCase())
      );

      const rewards = tier?.rewards || [];
      const cosmeticIds = rewards.filter((r: any) => r.type === 'cosmetic').map((r: any) => r.id || r.itemId).filter(Boolean);

      if (cosmeticIds.length > 0) {
        const { data: mcUser } = await supabaseAdmin.from('minecraft_users').select('unlocked_cosmetics').eq('uuid', mUuid).maybeSingle();
        const current = mcUser?.unlocked_cosmetics || [];
        const newSet = new Set([...current, ...cosmeticIds]);
        
        await supabaseAdmin.from('minecraft_users').upsert({
            uuid: mUuid,
            unlocked_cosmetics: Array.from(newSet),
            updated_at: new Date().toISOString()
        });

        const rewardId = `kofi-sync-${userId}-${mUuid}-${profile.kofi_subscription.tierName.toLowerCase().replace(/\s+/g, '-')}`;
        await supabaseAdmin.from('user_rewards').upsert({
            id: rewardId,
            user_id: userId,
            minecraft_uuid: mUuid,
            source: 'kofi_sync',
            source_id: profile.kofi_subscription.tierName,
            rewards: rewards,
            granted_at: Date.now()
        });
      }
    }
  } catch (err) {
    console.error("Failed to sync Minecraft rewards:", err);
  }
}

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
    twitchUsername: p.twitch_username,
    twitchId: p.twitch_id,
    twitchSubscriptionData: p.twitch_subscription_data,
    kofiSubscription: p.kofi_subscription
  };
}