
import { supabaseAdmin } from './lib/supabaseAdmin';
import { verifyAuthToken, corsResponse } from './lib/supabaseHelpers';

export const handler = async (event: any) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse(200, {});
    }

    // 1. Verify Authentication
    const { user, profile, error: authError } = await verifyAuthToken(event);
    if (authError || !user) {
        return corsResponse(401, { error: 'Unauthorized: ' + authError });
    }

    const { action } = event.queryStringParameters || {};
    let body: any = {};
    try {
        if (event.body) body = JSON.parse(event.body);
    } catch (e) {}

    // Environment variables
    const SE_JWT = process.env.STREAMELEMENTS_JWT;
    const SE_CHANNEL_ID = process.env.STREAMELEMENTS_CHANNEL_ID;

    if (!SE_JWT || !SE_CHANNEL_ID) {
        return corsResponse(500, { error: 'StreamElements system not configured. Missing JWT or Channel ID in environment.' });
    }

    try {
        // ACTION: Verify and sync subscription
        if (action === 'verifySubscription') {
            // Use provided username or fall back to profile data
            const twitchUsername = body.twitchUsername || profile?.twitch_username;
            
            if (!twitchUsername) {
                return corsResponse(400, { error: 'Twitch username required (not provided and not in profile)' });
            }

            // 1. Call StreamElements API to check subscriber status
            // Format: GET https://api.streamelements.com/v2/channels/{channelId}/subscribers/{username}
            let seResponse = await fetch(`https://api.streamelements.com/v2/channels/${SE_CHANNEL_ID}/subscribers/${encodeURIComponent(twitchUsername)}`, {
                headers: {
                    'Authorization': `Bearer ${SE_JWT}`,
                    'Accept': 'application/json'
                }
            });

            // Fallback: try lowercase if 404
            if (!seResponse.ok && seResponse.status === 404) {
                const lowerUsername = twitchUsername.toLowerCase();
                if (lowerUsername !== twitchUsername) {
                    console.log(`[StreamElements] 404 for ${twitchUsername}, trying lowercase: ${lowerUsername}`);
                    seResponse = await fetch(`https://api.streamelements.com/v2/channels/${SE_CHANNEL_ID}/subscribers/${encodeURIComponent(lowerUsername)}`, {
                        headers: {
                            'Authorization': `Bearer ${SE_JWT}`,
                            'Accept': 'application/json'
                        }
                    });
                }
            }

            if (!seResponse.ok) {
                if (seResponse.status === 404) {
                    console.log(`[StreamElements] Subscriber not found: ${twitchUsername}`);
                    return corsResponse(200, { 
                        success: false, 
                        isSub: false, 
                        message: 'No subscription found for this Twitch user on your channel.' 
                    });
                }
                const errText = await seResponse.text();
                console.error(`[StreamElements] API Error for ${twitchUsername}:`, seResponse.status, errText);
                throw new Error(`StreamElements API failed: ${errText}`);
            }

            const data = await seResponse.json();
            console.log(`[StreamElements] Success for ${twitchUsername}:`, JSON.stringify(data));
            
            // Check if isSub is true (StreamElements returns this property)
            if (data.isSub) {
                // 2. Update Profile with Twitch Data
                await supabaseAdmin.from('profiles').update({
                    twitch_username: twitchUsername,
                    twitch_subscription_data: {
                        isSub: true,
                        tier: data.tier,
                        avatar: data.avatar,
                        lastModified: new Date().toISOString()
                    }
                }).eq('id', user.id);

                // 3. Grant Subscriber-only Cosmetics
                // We fetch cosmetics that are marked as is_subscriber_only = true
                const { data: subCosmetics } = await supabaseAdmin
                    .from('cosmetics')
                    .select('id')
                    .eq('is_subscriber_only', true);

                let grantedRewards: string[] = [];
                if (subCosmetics && subCosmetics.length > 0 && profile?.minecraft_uuid) {
                    const cosmeticIds = subCosmetics.map(c => c.id);
                    grantedRewards = cosmeticIds;
                    
                    // Create a reward entry in user_rewards table with expiration (1 month)
                    const now = Date.now();
                    const oneDayMs = 24 * 60 * 60 * 1000;
                    const expiresAt = now + (31 * oneDayMs); // Roughly 1 month

                    // Use an idempotent ID for the subscription reward
                    const rewardId = `sub-reward-${user.id}`;
                    
                    const { error: rewardErr } = await supabaseAdmin.from('user_rewards').upsert({
                        id: rewardId,
                        user_id: user.id,
                        minecraft_uuid: profile.minecraft_uuid,
                        source: 'streamelements',
                        source_id: 'twitch_subscription',
                        rewards: cosmeticIds.map(id => ({ type: 'cosmetic', id })),
                        granted_at: now,
                        expires_at: expiresAt
                    });

                    if (rewardErr) throw rewardErr;
                }

                return corsResponse(200, {
                    success: true,
                    isSub: true,
                    tier: data.tier,
                    grantedRewards: grantedRewards,
                    expiresAt: new Date(Date.now() + (31 * 24 * 60 * 60 * 1000)).toISOString()
                });
            } else {
                // Update profile to mark as not subscribed
                await supabaseAdmin.from('profiles').update({
                    twitch_subscription_data: {
                        isSub: false,
                        lastModified: new Date().toISOString()
                    }
                }).eq('id', user.id);

                return corsResponse(200, { 
                    success: false, 
                    isSub: false, 
                    message: 'User found but no active subscription detected.' 
                });
            }
        }

        return corsResponse(400, { error: 'Invalid action specified' });

    } catch (err: any) {
        console.error('StreamElements Function Error:', err);
        return corsResponse(500, { error: err.message || 'Internal Server Error' });
    }
};
