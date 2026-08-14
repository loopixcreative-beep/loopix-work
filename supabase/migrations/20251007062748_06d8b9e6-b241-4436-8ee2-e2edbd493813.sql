-- Create storage bucket for calendar entry images
INSERT INTO storage.buckets (id, name, public)
VALUES ('calendar-images', 'calendar-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for calendar images
CREATE POLICY "Users can view calendar images"
ON storage.objects FOR SELECT
USING (bucket_id = 'calendar-images');

CREATE POLICY "Authenticated users can upload calendar images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'calendar-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own calendar images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'calendar-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own calendar images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'calendar-images' AND
  auth.role() = 'authenticated'
);