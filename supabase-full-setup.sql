-- BUILDSCAPE FULL SETUP SCRIPT
-- This script combines all database tables, policies, functions, triggers, and storage buckets.
-- It is designed to be idempotent (can be run multiple times safely).

-- ==========================================
-- 1. BASE TABLES
-- ==========================================

-- profiles: extends auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
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
  twitch_id TEXT,
  twitch_username TEXT,
  twitch_subscription_data JSONB DEFAULT NULL,
  liked_features TEXT[] DEFAULT '{}',
  favorite_features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- legacy_users: migration support
CREATE TABLE IF NOT EXISTS public.legacy_users (
  email                  TEXT PRIMARY KEY,
  username               TEXT NOT NULL,
  old_role               TEXT DEFAULT 'user',
  old_minecraft_username TEXT,
  old_minecraft_uuid     TEXT,
  old_kofi_username      TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- reports (bug reports)
CREATE TABLE IF NOT EXISTS public.reports (
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

-- suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
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

-- config (single row)
CREATE TABLE IF NOT EXISTS public.config (
  id TEXT PRIMARY KEY DEFAULT 'main_config',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- changelogs
CREATE TABLE IF NOT EXISTS public.changelogs (
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

-- wiki_features
CREATE TABLE IF NOT EXISTS public.wiki_features (
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
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ko-fi tables
CREATE TABLE IF NOT EXISTS public.kofi_payments (
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

CREATE TABLE IF NOT EXISTS public.kofi_manual_rewards (
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

-- Redeem code tables
CREATE TABLE IF NOT EXISTS public.redeem_codes (
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

CREATE TABLE IF NOT EXISTS public.code_redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES redeem_codes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Keep for legacy/mc fallback
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Proper FK for join
  minecraft_uuid TEXT,
  rewards JSONB DEFAULT '[]',
  redeemed_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_rewards (
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

-- Minecraft/Supporter tables
CREATE TABLE IF NOT EXISTS public.minecraft_users (
  uuid TEXT PRIMARY KEY,
  unlocked_cosmetics TEXT[] DEFAULT '{}',
  selected_cosmetics JSONB DEFAULT '{}',
  redeemed_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cosmetics (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  is_code_based BOOLEAN DEFAULT false,
  is_admin_granted BOOLEAN DEFAULT false,
  is_subscriber_only BOOLEAN DEFAULT false,
  created_at BIGINT,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.supporters (
  uuid TEXT PRIMARY KEY,
  website_username TEXT,
  minecraft_username TEXT,
  membership_tier TEXT,
  connected_at BIGINT,
  last_seen BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.connection_codes (
  id TEXT PRIMARY KEY,
  uuid TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.support_tiers (
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

-- ==========================================
-- 2. ADD MISSING COLUMNS (Idempotent)
-- ==========================================
DO $$ 
BEGIN
  -- Add cosmetic_ids if it was missing from older schema versions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='redeem_codes' AND column_name='cosmetic_ids') THEN
    ALTER TABLE public.redeem_codes ADD COLUMN cosmetic_ids TEXT[] DEFAULT '{}';
  END IF;

  -- Add author_id to code_redemptions if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='code_redemptions' AND column_name='author_id') THEN
    ALTER TABLE public.code_redemptions ADD COLUMN author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    
    -- DATA MIGRATION: Try to populate author_id from existing user_id if it's a UUID
    UPDATE public.code_redemptions 
    SET author_id = user_id::UUID 
    WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;

  -- Add liked_features/favorite_features if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='liked_features') THEN
    ALTER TABLE public.profiles ADD COLUMN liked_features TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='favorite_features') THEN
    ALTER TABLE public.profiles ADD COLUMN favorite_features TEXT[] DEFAULT '{}';
  END IF;

  -- Add likes missing in wiki_features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wiki_features' AND column_name='likes') THEN
    ALTER TABLE public.wiki_features ADD COLUMN likes INTEGER DEFAULT 0;
  END IF;

  -- Add any other columns that were added in later scripts here...
END $$;

-- ==========================================
-- 3. INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reports_author_id ON reports(author_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_timestamp ON suggestions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_changelogs_file_date ON changelogs(file_date DESC);
CREATE INDEX IF NOT EXISTS idx_kofi_payments_user_id ON kofi_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_kofi_manual_rewards_user_id ON kofi_manual_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_code ON redeem_codes(code);
CREATE INDEX IF NOT EXISTS idx_code_redemptions_user_id ON code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_code_redemptions_code_id ON code_redemptions(code_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_cosmetics_is_default ON cosmetics(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_connection_codes_uuid ON connection_codes(uuid);

-- ==========================================
-- 4. FUNCTIONS & TRIGGERS
-- ==========================================

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Get base username from metadata or email
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;

  -- Attempt to insert, appending counter on collision
  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, email, role)
      VALUES (NEW.id, final_username, NEW.email, 'user');
      EXIT; -- Success
    EXCEPTION WHEN unique_violation THEN
      counter := counter + 1;
      final_username := base_username || counter::text;
      
      -- If many collisions, use a more unique suffix
      IF counter > 5 THEN
        final_username := base_username || '_' || substr(NEW.id::text, 1, 4);
      END IF;
      
      -- Final safety break to avoid infinite loop
      IF counter > 10 THEN
        RAISE EXCEPTION 'Could not generate unique username after 10 attempts';
      END IF;
    END;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check admin/owner role
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==========================================
-- 5. RLS POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_users ENABLE ROW LEVEL SECURITY;
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

-- Helper to safely create policies
CREATE OR REPLACE FUNCTION public.create_policy_if_not_exists(
  p_name TEXT, p_table TEXT, p_cmd TEXT, p_role TEXT, p_using TEXT, p_check TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = p_name AND tablename = p_table) THEN
    EXECUTE 'CREATE POLICY ' || quote_ident(p_name) || ' ON ' || quote_ident(p_table) || 
            ' FOR ' || p_cmd || ' TO ' || p_role || ' USING (' || p_using || ')' ||
            CASE WHEN p_check IS NOT NULL THEN ' WITH CHECK (' || p_check || ')' ELSE '' END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply Policies
SELECT create_policy_if_not_exists('profiles_select', 'profiles', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('profiles_update_own', 'profiles', 'UPDATE', 'authenticated', 'auth.uid() = id');
SELECT create_policy_if_not_exists('profiles_admin_all', 'profiles', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('legacy_users_select_own', 'legacy_users', 'SELECT', 'authenticated', 'LOWER(email) = auth.jwt()->>''email''');
SELECT create_policy_if_not_exists('legacy_users_admin_all', 'legacy_users', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('reports_select', 'reports', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('reports_insert', 'reports', 'INSERT', 'authenticated', 'true', 'true');
SELECT create_policy_if_not_exists('reports_update', 'reports', 'UPDATE', 'authenticated', 'author_id = auth.uid() OR is_admin_or_owner()');

SELECT create_policy_if_not_exists('suggestions_select', 'suggestions', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('suggestions_insert', 'suggestions', 'INSERT', 'authenticated', 'true', 'true');
SELECT create_policy_if_not_exists('suggestions_update', 'suggestions', 'UPDATE', 'authenticated', 'author_id = auth.uid() OR is_admin_or_owner()');

SELECT create_policy_if_not_exists('config_select', 'config', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('config_all_admin', 'config', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('changelogs_select', 'changelogs', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('changelogs_all_admin', 'changelogs', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('wiki_select', 'wiki_features', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('wiki_all_admin', 'wiki_features', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('cosmetics_select', 'cosmetics', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('cosmetics_all_admin', 'cosmetics', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('support_tiers_select', 'support_tiers', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('support_tiers_all_admin', 'support_tiers', 'ALL', 'authenticated', 'is_admin_or_owner()');

SELECT create_policy_if_not_exists('redeem_codes_admin', 'redeem_codes', 'ALL', 'authenticated', 'is_admin_or_owner()');
SELECT create_policy_if_not_exists('code_redemptions_admin', 'code_redemptions', 'ALL', 'authenticated', 'is_admin_or_owner()');
SELECT create_policy_if_not_exists('code_redemptions_own', 'code_redemptions', 'SELECT', 'public', 'true');

SELECT create_policy_if_not_exists('minecraft_users_select', 'minecraft_users', 'SELECT', 'public', 'true'); -- Needed for mod & web display
SELECT create_policy_if_not_exists('minecraft_users_update_own', 'minecraft_users', 'UPDATE', 'authenticated', 'uuid = (SELECT minecraft_uuid FROM profiles WHERE id = auth.uid()) OR is_admin_or_owner()');

SELECT create_policy_if_not_exists('user_rewards_select_own', 'user_rewards', 'SELECT', 'public', 'user_id = auth.uid()::text OR minecraft_uuid = (SELECT minecraft_uuid FROM profiles WHERE id = auth.uid()) OR is_admin_or_owner()');
SELECT create_policy_if_not_exists('kofi_payments_select', 'kofi_payments', 'SELECT', 'public', 'true');
SELECT create_policy_if_not_exists('kofi_manual_rewards_admin', 'kofi_manual_rewards', 'ALL', 'authenticated', 'is_admin_or_owner()');

-- ==========================================
-- 6. STORAGE BUCKETS & POLICIES
-- ==========================================

-- Create Buckets (Idempotent)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('reports', 'reports', true),
  ('wiki', 'wiki', true),
  ('suggestions', 'suggestions', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Idempotent via DO blocks)
DO $$ 
BEGIN
  -- Avatars
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Avatar public read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Avatar auth upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Avatar auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Avatar owner update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Avatar owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
  END IF;

  -- Reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Reports public read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Reports public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'reports');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Reports auth upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Reports auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');
  END IF;

  -- Wiki
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Wiki public read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Wiki public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'wiki');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Wiki admin modify' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Wiki admin modify" ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'wiki' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'owner')));
  END IF;
END $$;

-- ==========================================
-- 7. PERMISSIONS
-- ==========================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Done!
SELECT 'Buildscape Database Setup Complete!' as status, 
       (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables;
