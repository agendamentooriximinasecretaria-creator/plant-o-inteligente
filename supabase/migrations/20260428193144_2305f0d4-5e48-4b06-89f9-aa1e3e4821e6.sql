
-- Hardening do bucket privado de anexos de trocas
UPDATE storage.buckets
SET 
  public = false,
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
WHERE id = 'swap-attachments';

-- Garantir que delete físico no storage só seja feito por gestor master
-- (mantém auditoria — soft-delete é o caminho padrão via tabela swap_attachments)
DROP POLICY IF EXISTS "Swap attachments delete by owner or managers" ON storage.objects;

CREATE POLICY "Swap attachments physical delete master only"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'swap-attachments'
  AND public.has_role(auth.uid(), 'gestor_master'::public.app_role)
);
