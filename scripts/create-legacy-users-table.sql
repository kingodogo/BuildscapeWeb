-- Run this in Supabase Dashboard > SQL Editor
-- Creates the legacy_users table used for seamless in-place account migration.
-- OTP is handled entirely by Supabase Auth (signInWithOtp) — no extra columns needed.

CREATE TABLE IF NOT EXISTS legacy_users (
  email                  TEXT PRIMARY KEY,
  username               TEXT NOT NULL,
  old_role               TEXT DEFAULT 'user',
  old_minecraft_username TEXT,
  old_minecraft_uuid     TEXT,
  old_kofi_username      TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE legacy_users ENABLE ROW LEVEL SECURITY;

-- Service role (Netlify functions + migration script) gets full access
CREATE POLICY "Service role full access on legacy_users"
  ON legacy_users FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated can read their own record
CREATE POLICY "Users can read own legacy record"
  ON legacy_users FOR SELECT TO authenticated
  USING (LOWER(email) = auth.jwt()->>'email');
