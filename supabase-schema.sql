-- MongoDB to Supabase Migration Schema
-- This SQL should be executed in the Supabase SQL Editor

-- profiles: extends auth.users with app-specific fields
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  minecraft_username TEXT,
  minecraft_uuid TEXT UNIQUE,
  kofi_username TEXT,
  kofi_subscription JSONB DEFAULT NULL,
  streamer_mode BOOLEAN DEFAULT false,
  profile_icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- reports (bug reports) - comments stored as JSONB array to match existing shape
CREATE TABLE public.reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT DEFAULT '',
  versions TEXT[] DEFAULT '{}',
  mc_versions TEXT[] DEFAULT '{}',
  author TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  severity TEXT DEFAULT 'Low',
  status TEXT DEFAULT 'Open',
  assigned_to TEXT,
  resolved_by TEXT,
  tags TEXT[] DEFAULT '{}',
  links TEXT[] DEFAULT '{}',
  comments JSONB DEFAULT '[]',
  ai_analysis JSONB,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_timestamp ON reports(timestamp DESC);
CREATE INDEX idx_reports_author_id ON reports(author_id);

-- suggestions
CREATE TABLE public.suggestions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'Feature',
  priority TEXT DEFAULT 'Low',
  status TEXT DEFAULT 'Open',
  author TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  links TEXT[] DEFAULT '{}',
  comments JSONB DEFAULT '[]',
  upvotes INTEGER DEFAULT 0,
  mc_versions TEXT[] DEFAULT '{}',
  mod_versions TEXT[] DEFAULT '{}',
  rejection_reason TEXT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_suggestions_timestamp ON suggestions(timestamp DESC);

-- config (single row)
CREATE TABLE public.config (
  id TEXT PRIMARY KEY DEFAULT 'main_config',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- changelogs
CREATE TABLE public.changelogs (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT,
  mod_version TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mc_versions TEXT[] DEFAULT '{}',
  changelog TEXT NOT NULL,
  changelog_type TEXT DEFAULT 'html',
  file_date TEXT NOT NULL,
  download_url TEXT,
  is_latest BOOLEAN DEFAULT false,
  linked_bug_reports TEXT[] DEFAULT '{}',
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_changelogs_file_date ON changelogs(file_date DESC);

-- wiki_features
CREATE TABLE public.wiki_features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mc_versions TEXT[] DEFAULT '{}',
  mod_versions TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  subcategories TEXT[] DEFAULT '{}',
  description TEXT NOT NULL,
  description_type TEXT DEFAULT 'text',
  media TEXT,
  details TEXT[] DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ko-fi tables
CREATE TABLE public.kofi_payments (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kofi_username TEXT,
  message_id TEXT,
  type TEXT,
  amount TEXT,
  currency TEXT,
  tier_name TEXT,
  is_subscription BOOLEAN DEFAULT false,
  is_first_subscription BOOLEAN DEFAULT false,
  kofi_transaction_id TEXT,
  email TEXT,
  from_name TEXT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_kofi_payments_user_id ON kofi_payments(user_id);

CREATE TABLE public.kofi_manual_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  minecraft_uuid TEXT,
  rewards JSONB NOT NULL DEFAULT '[]',
  reason TEXT DEFAULT '',
  granted_by TEXT DEFAULT '',
  granted_at BIGINT NOT NULL,
  expires_at BIGINT,
  granted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_kofi_manual_rewards_user_id ON kofi_manual_rewards(user_id);

-- Redeem code tables
CREATE TABLE public.redeem_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  rewards JSONB DEFAULT '[]',
  cosmetic_ids TEXT[] DEFAULT '{}',
  description TEXT,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  used_by TEXT[] DEFAULT '{}',
  expires_at BIGINT,
  requires_membership TEXT,
  created_at_ts BIGINT NOT NULL,
  created_by TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_redeem_codes_code ON redeem_codes(code);

CREATE TABLE public.code_redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES redeem_codes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  minecraft_uuid TEXT,
  rewards JSONB DEFAULT '[]',
  redeemed_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_code_redemptions_user_id ON code_redemptions(user_id);
CREATE INDEX idx_code_redemptions_code_id ON code_redemptions(code_id);

CREATE TABLE public.user_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  minecraft_uuid TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  rewards JSONB DEFAULT '[]',
  granted_at BIGINT NOT NULL,
  expires_at BIGINT,
  downloaded BOOLEAN DEFAULT false,
  download_url TEXT,
  download_expires_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_user_rewards_user_id ON user_rewards(user_id);

-- Minecraft/Supporter tables
CREATE TABLE public.minecraft_users (
  uuid TEXT PRIMARY KEY,
  unlocked_cosmetics TEXT[] DEFAULT '{}',
  selected_cosmetics JSONB DEFAULT '{}',
  redeemed_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.cosmetics (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  is_code_based BOOLEAN DEFAULT false,
  is_admin_granted BOOLEAN DEFAULT false,
  created_at BIGINT,
  updated_at BIGINT
);
CREATE INDEX idx_cosmetics_is_default ON cosmetics(is_default) WHERE is_default = true;

CREATE TABLE public.supporters (
  uuid TEXT PRIMARY KEY,
  website_username TEXT,
  minecraft_username TEXT,
  membership_tier TEXT,
  connected_at BIGINT,
  last_seen BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.connection_codes (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false
);
CREATE INDEX idx_connection_codes_uuid ON connection_codes(uuid);

CREATE TABLE public.support_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  benefits TEXT[] DEFAULT '{}',
  cosmetics TEXT[] DEFAULT '{}',
  price TEXT,
  currency TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE kofi_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kofi_manual_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE minecraft_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE supporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tiers ENABLE ROW LEVEL SECURITY;

-- Helper: check admin/owner role
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE USING (is_admin_or_owner());
CREATE POLICY "profiles_admin_delete" ON profiles FOR DELETE USING (is_admin_or_owner());

-- PUBLIC READ tables (reports, suggestions, changelogs, wiki, config, cosmetics, support_tiers)
CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "reports_update" ON reports FOR UPDATE USING (author_id = auth.uid() OR is_admin_or_owner());
CREATE POLICY "reports_delete" ON reports FOR DELETE USING (author_id = auth.uid() OR is_admin_or_owner());

CREATE POLICY "suggestions_select" ON suggestions FOR SELECT USING (true);
CREATE POLICY "suggestions_insert" ON suggestions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "suggestions_update" ON suggestions FOR UPDATE USING (author_id = auth.uid() OR is_admin_or_owner());
CREATE POLICY "suggestions_delete" ON suggestions FOR DELETE USING (author_id = auth.uid() OR is_admin_or_owner());

CREATE POLICY "config_select" ON config FOR SELECT USING (true);
CREATE POLICY "config_all_admin" ON config FOR ALL USING (is_admin_or_owner());

CREATE POLICY "changelogs_select" ON changelogs FOR SELECT USING (true);
CREATE POLICY "changelogs_all_admin" ON changelogs FOR ALL USING (is_admin_or_owner());

CREATE POLICY "wiki_select" ON wiki_features FOR SELECT USING (true);
CREATE POLICY "wiki_all_admin" ON wiki_features FOR ALL USING (is_admin_or_owner());

CREATE POLICY "cosmetics_select" ON cosmetics FOR SELECT USING (true);
CREATE POLICY "cosmetics_all_admin" ON cosmetics FOR ALL USING (is_admin_or_owner());

CREATE POLICY "support_tiers_select" ON support_tiers FOR SELECT USING (true);
CREATE POLICY "support_tiers_all_admin" ON support_tiers FOR ALL USING (is_admin_or_owner());

-- ADMIN-ONLY tables
CREATE POLICY "redeem_codes_admin" ON redeem_codes FOR ALL USING (is_admin_or_owner());
CREATE POLICY "code_redemptions_own" ON code_redemptions FOR SELECT USING (true);
CREATE POLICY "code_redemptions_admin" ON code_redemptions FOR ALL USING (is_admin_or_owner());

-- USER-SCOPED tables
CREATE POLICY "user_rewards_select" ON user_rewards FOR SELECT USING (true);
CREATE POLICY "kofi_payments_select" ON kofi_payments FOR SELECT USING (true);
CREATE POLICY "kofi_manual_rewards_select" ON kofi_manual_rewards FOR SELECT USING (true);
CREATE POLICY "kofi_manual_rewards_admin" ON kofi_manual_rewards FOR ALL USING (is_admin_or_owner());

-- SERVICE-ROLE-ONLY tables (Minecraft mod endpoints bypass RLS via service_role)
-- No anon/authenticated policies needed - server functions use supabaseAdmin
CREATE POLICY "minecraft_users_service" ON minecraft_users FOR ALL USING (false);
CREATE POLICY "supporters_service" ON supporters FOR ALL USING (false);
CREATE POLICY "connection_codes_service" ON connection_codes FOR ALL USING (false);

-- Comments for documentation
COMMENT ON TABLE public.profiles IS 'Extends Supabase auth.users with app-specific user profile data';
COMMENT ON TABLE public.reports IS 'Bug reports and issue tracking system';
COMMENT ON TABLE public.suggestions IS 'Feature suggestions and community feedback';
COMMENT ON TABLE public.config IS 'Application configuration stored as JSONB for flexibility';
COMMENT ON TABLE public.changelogs IS 'Mod changelogs and release information';
COMMENT ON TABLE public.wiki_features IS 'Wiki documentation for mod features';
COMMENT ON TABLE public.kofi_payments IS 'Ko-fi payment and subscription tracking';
COMMENT ON TABLE public.kofi_manual_rewards IS 'Manually granted Ko-fi rewards';
COMMENT ON TABLE public.redeem_codes IS 'Redeemable codes for in-game rewards';
COMMENT ON TABLE public.code_redemptions IS 'Tracking of code redemptions by users';
COMMENT ON TABLE public.user_rewards IS 'User reward claims and tracking';
COMMENT ON TABLE public.minecraft_users IS 'Minecraft player data for cosmetics and rewards';
COMMENT ON TABLE public.cosmetics IS 'In-game cosmetic items and their metadata';
COMMENT ON TABLE public.supporters IS 'Supporter/membership information';
COMMENT ON TABLE public.connection_codes IS 'Temporary codes for Minecraft account linking';
COMMENT ON TABLE public.support_tiers IS 'Support tier definitions and benefits';

-- Grant appropriate permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;