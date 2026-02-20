
import { corsResponse } from './lib/supabaseHelpers';
import { supabaseAdmin } from './lib/supabaseAdmin';

export const handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') {
    return corsResponse(405, { error: 'Method not allowed' });
  }

  let bodyString = event.body;
  let webhookData: any;

  try {
    // Parse body. Can be URL-encoded or JSON?
    // Ko-fi documentation says x-www-form-urlencoded with 'data' field containing JSON string.
    let dataField = '';
    
    // Check if JSON first (Vercel/Netlify sometimes auto-parses or we receive raw)
    // If it's URL encoded string:
    if (typeof bodyString === 'string' && (bodyString.startsWith('data=') || bodyString.includes('&data='))) {
        const params = new URLSearchParams(bodyString);
        dataField = params.get('data') || '';
    } else {
        // Try parsing as JSON if sent that way
        try {
             const json = JSON.parse(bodyString);
             if (json.data) dataField = typeof json.data === 'string' ? json.data : JSON.stringify(json.data);
        } catch(e) {
             // Fallback
        }
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
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin.from('kofi_payments').insert({
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

    // Process Subscription for matched user
    if (webhookData.type === 'Subscription' || webhookData.type === 'Donation') {
        const now = Date.now();
        let nextPaymentDate = null;
        if (webhookData.is_subscription_payment && webhookData.type === 'Subscription') {
             const d = new Date();
             d.setMonth(d.getMonth() + 1);
             nextPaymentDate = d.getTime();
        }

        const subscription = {
            isActive: true,
            tierName: webhookData.tier_name || null,
            lastPaymentDate: now,
            nextPaymentDate: nextPaymentDate,
            amount: webhookData.amount,
            currency: webhookData.currency,
            kofiTransactionId: webhookData.kofi_transaction_id
        };

        await supabaseAdmin.from('profiles').update({ kofi_subscription: subscription }).eq('id', user.id);

        // SYNC REWARDS TO MINECRAFT ACCOUNT
        const mUuid = user.minecraft_uuid;
        if (mUuid && webhookData.tier_name) {
            // 1. Get tier cosmetics
            const { data: tier } = await supabaseAdmin
                .from('support_tiers')
                .select('cosmetics')
                .ilike('name', webhookData.tier_name)
                .maybeSingle();

            if (tier && tier.cosmetics && tier.cosmetics.length > 0) {
                // 2. Unlock in minecraft_users
                const { data: mcUser } = await supabaseAdmin
                    .from('minecraft_users')
                    .select('unlocked_cosmetics')
                    .eq('uuid', mUuid)
                    .maybeSingle();

                const current = mcUser?.unlocked_cosmetics || [];
                const newSet = new Set([...current, ...tier.cosmetics]);
                
                await supabaseAdmin.from('minecraft_users').upsert({
                    uuid: mUuid,
                    unlocked_cosmetics: Array.from(newSet),
                    updated_at: new Date().toISOString()
                });

                // 3. Record in user_rewards (visible on website)
                const rewardId = `kofi-${webhookData.message_id || Date.now()}`;
                await supabaseAdmin.from('user_rewards').insert({
                    id: rewardId,
                    user_id: user.id,
                    minecraft_uuid: mUuid,
                    source: 'kofi',
                    source_id: webhookData.message_id || webhookData.kofi_transaction_id,
                    rewards: tier.cosmetics.map((id: string) => ({ type: 'cosmetic', id })),
                    granted_at: now
                });
            }
        }
    }

    return corsResponse(200, { success: true });

  } catch (error: any) {
    console.error("Ko-fi Webhook Error:", error);
    return corsResponse(200, { error: 'Error processing webhook' }); // Return 200 to satisfy Ko-fi
  }
};
