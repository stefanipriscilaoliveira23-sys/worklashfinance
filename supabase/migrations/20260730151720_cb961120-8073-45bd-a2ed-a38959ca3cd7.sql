
CREATE POLICY "documentos select equipe" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "documentos insert equipe" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "documentos update equipe" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos') WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "documentos delete equipe" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos');
