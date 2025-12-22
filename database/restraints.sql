CREATE POLICY "Admins can insert stations" 
ON public.istasyonlar 
FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin());



ALTER TABLE gonderiler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gonderiler_select" ON gonderiler 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM senaryolar s WHERE s.id = senaryo_id AND (s.created_by = auth.uid() OR is_admin())));

CREATE POLICY "gonderiler_insert" ON gonderiler 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM senaryolar s WHERE s.id = senaryo_id AND (s.created_by = auth.uid() OR is_admin())));