/**
 * Ko-fi Webhook Types
 * Based on Ko-fi webhook documentation
 */

export interface KofiWebhookData {
  verification_token: string;
  message_id: string;
  timestamp: string;
  type: 'Donation' | 'Subscription' | 'Commission' | 'Shop Order';
  is_public: boolean;
  from_name: string;
  message: string | null;
  amount: string;
  url: string;
  email: string;
  currency: string;
  is_subscription_payment: boolean;
  is_first_subscription_payment: boolean;
  kofi_transaction_id: string;
  shop_items: KofiShopItem[] | null;
  tier_name: string | null;
  shipping: KofiShipping | null;
  discord_username?: string;
  discord_userid?: string;
}

export interface KofiShopItem {
  direct_link_code: string;
  variation_name?: string;
  quantity?: number;
}

export interface KofiShipping {
  full_name: string;
  street_address: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  country: string;
  country_code: string;
  telephone: string;
}

