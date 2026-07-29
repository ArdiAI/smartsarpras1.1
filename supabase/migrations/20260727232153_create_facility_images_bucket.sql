-- Create facility-images storage bucket for inventory & facility photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('facility-images', 'facility-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "facility_images_public_read" ON storage.objects;
CREATE POLICY "facility_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'facility-images');

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "facility_images_auth_insert" ON storage.objects;
CREATE POLICY "facility_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'facility-images');

-- Allow authenticated users to update
DROP POLICY IF EXISTS "facility_images_auth_update" ON storage.objects;
CREATE POLICY "facility_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'facility-images') WITH CHECK (bucket_id = 'facility-images');

-- Allow authenticated users to delete
DROP POLICY IF EXISTS "facility_images_auth_delete" ON storage.objects;
CREATE POLICY "facility_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'facility-images');
