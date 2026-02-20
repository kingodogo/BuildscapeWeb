
/**
 * Microsoft/Xbox/Minecraft OAuth authentication flow handler
 */

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

export interface MinecraftProfile {
  id: string;
  name: string;
}

export async function getMinecraftProfileFromCode(code: string, redirectUri: string): Promise<MinecraftProfile> {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || MICROSOFT_CLIENT_ID === 'your-client-id-here') {
    throw new Error('Microsoft OAuth not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in Netlify environment variables.');
  }

  // 1. Exchange code for Microsoft Access Token
  const msTokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: 'XboxLive.signin offline_access'
    })
  });

  if (!msTokenRes.ok) {
    const error = await msTokenRes.json();
    console.error('Microsoft Token Error:', error);
    throw new Error(`failed to get microsoft token: ${error.error_description || msTokenRes.statusText}`);
  }

  const msTokenData = await msTokenRes.json();
  const msAccessToken = msTokenData.access_token;

  // 2. Exchange Microsoft Access Token for Xbox Live Token
  const xboxAuthRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  });

  if (!xboxAuthRes.ok) {
    throw new Error(`failed to authenticate with xbox live: ${xboxAuthRes.statusText}`);
  }

  const xboxAuthData = await xboxAuthRes.json();
  const xboxToken = xboxAuthData.Token;
  const uhash = xboxAuthData.DisplayClaims.xui[0].uhs;

  // 3. Exchange Xbox Token for XSTS Token
  const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xboxToken]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  });

  if (!xstsRes.ok) {
    if (xstsRes.status === 401) {
      throw new Error('this microsoft account does not have an xbox profile');
    }
    throw new Error(`failed to get xsts token: ${xstsRes.statusText}`);
  }

  const xstsData = await xstsRes.json();
  const xstsToken = xstsData.Token;

  // 4. Exchange XSTS Token for Minecraft Access Token
  const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${uhash};${xstsToken}`
    })
  });

  if (!mcLoginRes.ok) {
    throw new Error(`failed to login to minecraft: ${mcLoginRes.statusText}`);
  }

  const mcLoginData = await mcLoginRes.json();
  const mcAccessToken = mcLoginData.access_token;

  // 5. Get Minecraft Profile
  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { 'Authorization': `Bearer ${mcAccessToken}` }
  });

  if (!profileRes.ok) {
    if (profileRes.status === 404) {
      throw new Error('this microsoft account does not own minecraft');
    }
    throw new Error(`failed to get minecraft profile: ${profileRes.statusText}`);
  }

  const profileData = await profileRes.json();
  return {
    id: profileData.id,
    name: profileData.name
  };
}

export function getMicrosoftLoginUrl(redirectUri: string): string {
  if (!MICROSOFT_CLIENT_ID || MICROSOFT_CLIENT_ID === 'your-client-id-here') {
    throw new Error('Microsoft OAuth not configured on the server.');
  }
  
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'XboxLive.signin offline_access',
    prompt: 'select_account'
  });
  
  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
}
