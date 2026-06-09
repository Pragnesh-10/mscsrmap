-- 0. Create a secure function to check roles (bypasses cross-schema search_path issues)
CREATE OR REPLACE FUNCTION public.is_core_member()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'core_member')
  );
$$;

-- 1. Fix Events RLS
DROP POLICY IF EXISTS "Allow core members to manage events" ON public.events;
CREATE POLICY "Allow core members to manage events" ON public.events 
    FOR ALL TO authenticated
    USING (public.is_core_member())
    WITH CHECK (public.is_core_member());

-- 2. Fix Team Members RLS
DROP POLICY IF EXISTS "Allow core members to manage team_members" ON public.team_members;
CREATE POLICY "Allow core members to manage team_members" ON public.team_members 
    FOR ALL TO authenticated
    USING (public.is_core_member())
    WITH CHECK (public.is_core_member());

-- 3. Fix Storage Images RLS (Ensuring strict bucket access without cross-schema errors)
DROP POLICY IF EXISTS "Allow core members to upload images" ON storage.objects;
CREATE POLICY "Allow core members to upload images" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'images' AND public.is_core_member()
    );

DROP POLICY IF EXISTS "Allow core members to update images" ON storage.objects;
CREATE POLICY "Allow core members to update images" ON storage.objects
    FOR UPDATE TO authenticated USING (
        bucket_id = 'images' AND public.is_core_member()
    );
