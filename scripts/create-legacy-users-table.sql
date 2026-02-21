-- Run this in Supabase Dashboard > SQL Editor BEFORE running the migration script
-- This table stores old MongoDB user records so we can show a friendly
-- "please re-register" message when legacy users try to log in.

CREATE TABLE IF NOT EXISTS legacy_users (
  email          TEXT PRIMARY KEY,
  username       TEXT NOT NULL,
  old_role       TEXT DEFAULT 'user',
  old_minecraft_username TEXT,
  old_minecraft_uuid     TEXT,
  old_kofi_username      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Allow the service role key full access (used by migration script + auth function)
ALTER TABLE legacy_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on legacy_users"
  ON legacy_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anyone to READ (needed for the login check to work via anon key in frontend)
CREATE POLICY "Public can read legacy_users"
  ON legacy_users
  FOR SELECT
  TO anon, authenticated
  USING (true);
