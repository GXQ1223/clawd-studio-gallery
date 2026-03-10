-- Tighten storage upload policy: require project ownership for uploads
-- Previously relaxed to just bucket_id check, which allows any authenticated
-- user to upload to any project's folder.

DROP POLICY IF EXISTS "Authenticated users can upload project assets" ON storage.objects;

CREATE POLICY "Authenticated users can upload project assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-assets'
    AND (
      -- Allow uploads to projects the user owns
      EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id::text = (storage.foldername(name))[1]
          AND projects.user_id = auth.uid()
      )
      -- Also allow if the folder name doesn't match a project UUID (e.g. temp uploads)
      OR NOT EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id::text = (storage.foldername(name))[1]
      )
    )
  );
