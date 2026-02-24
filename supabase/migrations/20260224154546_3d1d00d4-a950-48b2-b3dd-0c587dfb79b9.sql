INSERT INTO storage.buckets (id, name, public)
VALUES ('mentoria-imports', 'mentoria-imports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read mentoria imports"
ON storage.objects FOR SELECT
USING (bucket_id = 'mentoria-imports');