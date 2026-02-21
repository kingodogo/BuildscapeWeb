-- RUN THIS IN THE SUPABASE SQL EDITOR
-- This script sets up the "pure" media infrastructure buckets and security policies.

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('reports', 'reports', true),
  ('wiki', 'wiki', true),
  ('suggestions', 'suggestions', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Avatars Policy (Everyone can read, Authenticated can upload/update their own)
CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "Avatar auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Avatar owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- 3. Reports Policy (Everyone can read, Authenticated can upload)
CREATE POLICY "Reports public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'reports');
CREATE POLICY "Reports auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');

-- 4. Wiki Policy (Everyone can read, Admin/Owner can modify)
CREATE POLICY "Wiki public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'wiki');
CREATE POLICY "Wiki admin modify" ON storage.objects FOR ALL TO authenticated 
USING (
  bucket_id = 'wiki' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'owner')
  )
);
