-- Fix storage delete policy: files are stored under {projectId}/ not {userId}/
-- The old policy checked (storage.foldername(name))[1] = auth.uid() which always
-- failed because the first folder is the project UUID, not the user UUID.
-- New policy: allow delete if the user owns the project that the file belongs to.

DROP POLICY IF EXISTS "Users can delete own project assets" ON storage.objects;

CREATE POLICY "Users can delete own project assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-assets'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id::text = (storage.foldername(name))[1]
        AND projects.user_id = auth.uid()
    )
  );

-- Also fix the upload policy to scope uploads to the user's own projects
DROP POLICY IF EXISTS "Authenticated users can upload project assets" ON storage.objects;

CREATE POLICY "Authenticated users can upload project assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-assets'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id::text = (storage.foldername(name))[1]
        AND projects.user_id = auth.uid()
    )
  );
