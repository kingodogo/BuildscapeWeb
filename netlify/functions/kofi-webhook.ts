
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
    if (!kofiUsername) return corsResponse(200, { message: 'No username found' });

    // Find User (Case Insensitive)
    const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('kofi_username', kofiUsername)
        .maybeSingle();

    if (!user) {
        // Log valid payment but no user found
        console.log(`Payment received for ${kofiUsername} (no user linked)`);
        return corsResponse(200, { message: 'User not found' });
    }

    // Update exact casing if needed
    if (user.kofi_username !== kofiUsername) {
        await supabaseAdmin.from('profiles').update({ kofi_username: kofiUsername }).eq('id', user.id);
    }

    // Process Subscription
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

        // Record Payment
        await supabaseAdmin.from('kofi_payments').insert({
            user_id: user.id,
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
        });
    }

    return corsResponse(200, { success: true });

  } catch (error: any) {
    console.error("Ko-fi Webhook Error:", error);
    return corsResponse(200, { error: 'Error processing webhook' }); // Return 200 to satisfy Ko-fi
  }
};
