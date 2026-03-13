
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  let rawBody = event.body;
  if (event.isBase64Encoded) {
    rawBody = Buffer.from(event.body, 'base64').toString('utf8');
  }

  let webhookData: any;

  try {
    let dataField = '';
    
    if (typeof rawBody === 'string' && (rawBody.startsWith('data=') || rawBody.includes('&data='))) {
        const params = new URLSearchParams(rawBody);
        dataField = params.get('data') || '';
    } else if (typeof rawBody === 'string') {
        try {
             const json = JSON.parse(rawBody);
             if (json.data) dataField = typeof json.data === 'string' ? json.data : JSON.stringify(json.data);
             else if (json.verification_token) dataField = rawBody; 
        } catch(e) {}
    }

    if (!dataField) return corsResponse(400, { error: 'Missing data field' });
    webhookData = JSON.parse(dataField);

    const expectedToken = process.env.KOFI_VERIFICATION_TOKEN;
    if (expectedToken && webhookData.verification_token !== expectedToken) {
        return corsResponse(401, { error: 'Invalid verification token' });
    }

    const kofiUsername = webhookData.from_name?.trim();
    const message = webhookData.message?.trim() || "";
    
    let user: any = null;

    // 1. Try to find user by Ko-fi username (Case Insensitive)
    if (kofiUsername) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .ilike('kofi_username', kofiUsername)
            .maybeSingle();
        user = profile;
        
        // Update exact casing if needed
        if (user && user.kofi_username !== kofiUsername) {
            await supabaseAdmin.from('profiles').update({ kofi_username: kofiUsername }).eq('id', user.id);
        }
    }

    const now = Date.now();

    // Record Payment (Always, even if no user found)
    const paymentId = webhookData.message_id || `kofi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin.from('kofi_payments').insert({
        id: paymentId,
        user_id: user?.id || null, // Link if found, otherwise null (unclaimed)
        kofi_username: kofiUsername,
        message_id: webhookData.message_id,
        type: webhookData.type,
        amount: webhookData.amount,
        currency: webhookData.currency,
        tier_name: webhookData.tier_name,
        is_subscription: webhookData.is_subscription_payment || false,
        is_first_subscription: webhookData.is_first_subscription_payment || false,
        kofi_transaction_id: webhookData.kofi_transaction_id,
        email: webhookData.email,
        from_name: webhookData.from_name,
        timestamp: now
    }).select().single();

    if (paymentError) {
        console.error("Failed to record payment:", paymentError);
    }

    if (!user) {
        console.log(`Unclaimed payment recorded for ${kofiUsername}`);
        return corsResponse(200, { message: 'Unclaimed payment recorded' });
    }

    // Process Subscription, Donation, or Shop items for matched user
    if (webhookData.type === 'Subscription' || webhookData.type === 'Donation' || webhookData.type === 'Shop') {
        const now = Date.now();
        let nextPaymentDate = null;
        if (webhookData.is_subscription_payment && webhookData.type === 'Subscription') {
             const d = new Date();
             d.setMonth(d.getMonth() + 1);
             nextPaymentDate = d.getTime();
        }

        const subscription = {
            isActive: true,
            tierName: webhookData.tier_name || (webhookData.type === 'Shop' ? 'Shop Item' : 'Donation'),
            lastPaymentDate: now,
            nextPaymentDate: nextPaymentDate,
            amount: webhookData.amount,
            currency: webhookData.currency,
            kofiTransactionId: webhookData.kofi_transaction_id
        };

        // Update profile with subscription info
        const { error: profileError } = await supabaseAdmin.from('profiles').update({ kofi_subscription: subscription }).eq('id', user.id);
        if (profileError) console.error("Failed to update profile subscription:", profileError);

        // SYNC REWARDS TO MINECRAFT ACCOUNT
        const mUuid = user.minecraft_uuid;
        
        // 1. Get tiers from Config instead of support_tiers table (which isn't used by admin)
        const { data: configRes } = await supabaseAdmin.from('config').select('data').eq('id', 'main_config').maybeSingle();
        const config = configRes?.data;
        
        if (mUuid && config?.kofiTiers) {
            // Find matching tier or shop item (Case Insensitive)
            const tier = config.kofiTiers.find((t: any) => 
                (webhookData.tier_name && (
                    t.koFiTierName?.toLowerCase() === webhookData.tier_name.toLowerCase() || 
                    t.name?.toLowerCase() === webhookData.tier_name.toLowerCase()
                )) ||
                (webhookData.type === 'Shop' && webhookData.shop_items?.some((item: any) => 
                    item.direct_link_code?.toLowerCase() === t.koFiTierName?.toLowerCase() || 
                    item.name?.toLowerCase() === t.name?.toLowerCase()
                ))
            );

            const rewards = tier?.rewards || [];

            if (tier && rewards.length > 0) {
                console.log(`Granting ${rewards.length} rewards for tier: ${tier.name} to ${mUuid}`);
                
                // 1. Separate cosmetic IDs for minecraft_users table
                const cosmeticIds = rewards
                    .filter((r: any) => r.type === 'cosmetic')
                    .map((r: any) => r.id || r.itemId) // items might use id or itemId
                    .filter(Boolean);

                if (cosmeticIds.length > 0) {
                    const { data: mcUser } = await supabaseAdmin
                        .from('minecraft_users')
                        .select('unlocked_cosmetics')
                        .eq('uuid', mUuid)
                        .maybeSingle();

                    const current = mcUser?.unlocked_cosmetics || [];
                    const newSet = new Set([...current, ...cosmeticIds]);
                    
                    const { error: mcUpdateError } = await supabaseAdmin.from('minecraft_users').upsert({
                        uuid: mUuid,
                        unlocked_cosmetics: Array.from(newSet),
                        updated_at: new Date().toISOString()
                    });
                    if (mcUpdateError) console.error("Failed to update minecraft_users cosms:", mcUpdateError);
                }

                // 2. Record full reward objects in user_rewards (visible on website)
                const rewardId = `kofi-${webhookData.message_id || Date.now()}`;
                const { error: rewardError } = await supabaseAdmin.from('user_rewards').insert({
                    id: rewardId,
                    user_id: user.id,
                    minecraft_uuid: mUuid,
                    source: 'kofi',
                    source_id: webhookData.message_id || webhookData.kofi_transaction_id,
                    rewards: rewards,
                    granted_at: now
                });
                if (rewardError) console.error("Failed to record reward history:", rewardError);
                
                console.log(`Successfully processed rewards for ${user.username}`);
            } else {
                console.log(`No matching tier or rewards found for "${webhookData.tier_name}" (Type: ${webhookData.type})`);
            }
        } else if (!mUuid) {
            console.log("User found but no Minecraft UUID linked. Skipping reward sync.");
        }
    }

    return corsResponse(200, { success: true });

  } catch (error: any) {
    console.error("Ko-fi Webhook Error:", error);
    return corsResponse(200, { error: 'Error processing webhook' }); // Return 200 to satisfy Ko-fi
  }
};
