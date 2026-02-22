
import fetch from 'node-fetch';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

export function getTwitchLoginUrl(redirectUri: string) {
    if (!CLIENT_ID) throw new Error('TWITCH_CLIENT_ID is not configured');
    
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'user:read:email', // Basic scope to get identity
    });
    
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export async function getTwitchProfileFromCode(code: string, redirectUri: string) {
    if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Twitch OAuth not configured');
    
    // 1. Get Access Token
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        })
    });
    
    if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(`Twitch Token Error: ${JSON.stringify(err)}`);
    }
    
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    
    // 2. Get User Profile
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
            'Client-ID': CLIENT_ID,
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    if (!userRes.ok) {
        const err = await userRes.json();
        throw new Error(`Twitch User Error: ${JSON.stringify(err)}`);
    }
    
    const userData = await userRes.json();
    if (!userData.data || userData.data.length === 0) {
        throw new Error('Twitch profile not found');
    }
    
    return userData.data[0]; // { id, login, display_name, profile_image_url, email }
}
