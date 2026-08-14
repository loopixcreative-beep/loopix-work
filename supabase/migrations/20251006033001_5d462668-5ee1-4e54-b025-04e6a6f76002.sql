-- Update project_type enum with new categories
ALTER TYPE project_type RENAME TO project_type_old;

CREATE TYPE project_type AS ENUM (
  'digital_marketing',
  'website_development',
  'mobile_app_development',
  'ui_ux_design',
  'graphics_design',
  'video_production',
  'branding_creative',
  'it_software_integration'
);

-- Update the projects table to use the new enum
ALTER TABLE projects 
  ALTER COLUMN type DROP DEFAULT,
  ALTER COLUMN type TYPE project_type USING 
    CASE 
      WHEN type::text = 'kanban' THEN 'website_development'::project_type
      WHEN type::text = 'scrum' THEN 'mobile_app_development'::project_type
      ELSE 'website_development'::project_type
    END,
  ALTER COLUMN type SET DEFAULT 'website_development'::project_type;

-- Drop the old enum type
DROP TYPE project_type_old;

-- Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for profile images
CREATE POLICY "Anyone can view profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload their own profile image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);