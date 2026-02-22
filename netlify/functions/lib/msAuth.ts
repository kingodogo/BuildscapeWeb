
/**
 * Microsoft/Xbox/Minecraft OAuth authentication flow handler
 * Based on: https://wiki.vg/Microsoft_Authentication_Scheme
 */

const MICROSOFT_CLIENT_ID = (process.env.MICROSOFT_CLIENT_ID || '').trim();
const MICROSOFT_CLIENT_SECRET = (process.env.MICROSOFT_CLIENT_SECRET || '').trim();

export interface MinecraftProfile {
  id: string;
  name: string;
}

export async function getMinecraftProfileFromCode(code: string, redirectUri: string): Promise<MinecraftProfile> {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || MICROSOFT_CLIENT_ID === 'your-client-id-here') {
    throw new Error('Microsoft OAuth not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in Netlify environment variables.');
  }

  // ── Step 1: Exchange authorization code for Microsoft Access Token ──
  // Must use /consumers/ tenant - /common/ will fail with XboxLive.signin scope
  const msTokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: 'XboxLive.signin',
    }),
  });

  if (!msTokenRes.ok) {
    const error = await msTokenRes.json().catch(() => ({}));
    console.error('[msAuth] Step 1 - MS Token Error:', JSON.stringify(error));
    throw new Error(`failed to get microsoft token: ${error.error_description || msTokenRes.statusText}`);
  }

  const msTokenData = await msTokenRes.json();
  const msAccessToken = msTokenData.access_token;
  if (!msAccessToken) throw new Error('microsoft token response had no access_token');

  // ── Step 2: Authenticate with Xbox Live ──
  // RpsTicket MUST be prefixed with "d=" per spec
  // RelyingParty MUST be "http://auth.xboxlive.com" (no trailing slash)
  const xboxAuthRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`, // MUST have "d=" prefix
      },
      RelyingParty: 'http://auth.xboxlive.com', // NO trailing slash per spec
      TokenType: 'JWT',
    }),
  });

  if (!xboxAuthRes.ok) {
    const errorBody = await xboxAuthRes.json().catch(() => ({}));
    console.error('[msAuth] Step 2 - Xbox Auth Error:', JSON.stringify(errorBody));
    throw new Error(`failed to authenticate with xbox live: ${errorBody.Message || xboxAuthRes.statusText}`);
  }

  const xboxAuthData = await xboxAuthRes.json();
  const xboxToken = xboxAuthData.Token;
  const uhash = xboxAuthData.DisplayClaims?.xui?.[0]?.uhs;

  if (!xboxToken) throw new Error('xbox live response had no Token');
  if (!uhash) throw new Error('xbox live response had no user hash (uhs)');

  // ── Step 3: Obtain XSTS Token for Minecraft ──
  // RelyingParty MUST be "rp://api.minecraftservices.com/" (WITH trailing slash per spec)
  const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xboxToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/', // WITH trailing slash per spec
      TokenType: 'JWT',
    }),
  });

  if (!xstsRes.ok) {
    const errorBody = await xstsRes.json().catch(() => ({}));
    console.error('[msAuth] Step 3 - XSTS Error:', JSON.stringify(errorBody));

    // Decode known XErr codes
    const xErr = Number(errorBody.XErr);
    if (xErr === 2148916227) throw new Error('your microsoft account is banned from Xbox Live');
    if (xErr === 2148916233) throw new Error('this microsoft account does not have an Xbox profile - please sign into minecraft.net first');
    if (xErr === 2148916235) throw new Error('Xbox Live is not available in your country');
    if (xErr === 2148916236 || xErr === 2148916237) throw new Error('adult verification required on Xbox Live (South Korea)');
    if (xErr === 2148916238) throw new Error('this account is a child account - add it to a Family on Xbox to continue');

    throw new Error(`failed to get xsts token: ${errorBody.Message || xstsRes.statusText}`);
  }

  const xstsData = await xstsRes.json();
  const xstsToken = xstsData.Token;
  if (!xstsToken) throw new Error('xsts response had no Token');

  // ── Step 4: Authenticate with Minecraft ──
  const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${uhash};${xstsToken}`,
    }),
  });

  if (!mcLoginRes.ok) {
    const errorBody = await mcLoginRes.json().catch(() => ({}));
    console.error('[msAuth] Step 4 - MC Login Error:', JSON.stringify(errorBody));
    throw new Error(`failed to login to minecraft: ${errorBody.errorMessage || mcLoginRes.statusText}`);
  }

  const mcLoginData = await mcLoginRes.json();
  const mcAccessToken = mcLoginData.access_token;
  if (!mcAccessToken) throw new Error('minecraft login response had no access_token');

  // ── Step 5: Get Minecraft Profile ──
  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { 'Authorization': `Bearer ${mcAccessToken}` },
  });

  if (!profileRes.ok) {
    const errorBody = await profileRes.json().catch(() => ({}));
    console.error('[msAuth] Step 5 - Profile Error:', JSON.stringify(errorBody));
    if (profileRes.status === 404) {
      throw new Error('this microsoft account does not own Minecraft Java Edition');
    }
    throw new Error(`failed to get minecraft profile: ${errorBody.errorMessage || profileRes.statusText}`);
  }

  const profileData = await profileRes.json();
  if (!profileData.id) throw new Error('minecraft profile response had no id');

  return {
    id: profileData.id,
    name: profileData.name,
  };
}

export function getMicrosoftLoginUrl(redirectUri: string): string {
  if (!MICROSOFT_CLIENT_ID || MICROSOFT_CLIENT_ID === 'your-client-id-here') {
    throw new Error('Microsoft OAuth not configured on the server.');
  }

  // MUST use /consumers/ tenant for XboxLive.signin scope
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'XboxLive.signin',
    prompt: 'select_account',
    state: 'microsoft'
  });

  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
}
