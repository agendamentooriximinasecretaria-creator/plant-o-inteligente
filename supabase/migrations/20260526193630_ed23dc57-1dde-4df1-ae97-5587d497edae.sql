-- Policy for reading stamps folder
CREATE POLICY "Pros can read stamps folder" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'professional-documents' 
  AND (
    (storage.foldername(name))[1] = 'stamps' 
    AND (
      (storage.foldername(name))[2] = (get_my_professional_id())::text 
      OR is_manager(auth.uid())
    )
  )
);

-- Ensure public access to stamps for document validation if needed (optional but useful for printed docs)
-- Since the system needs to render these in PDF/HTML which might be viewed by others, 
-- we should allow public select IF the bucket is meant for that. 
-- However, the code uses signed URLs or base64 conversion, so authenticated access is enough for generation.
