-- WARNING: THIS SCRIPT WILL PERMANENTLY DELETE ALL EXISTING DATA AND REBUILD THE SCHEMA FROM SCRATCH.

-- 0. Wipe Existing Schema
DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.member_profiles CASCADE;

-- Drop all overloaded versions of our RPC functions to prevent PostgREST endpoint collisions
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT oid::regprocedure AS fname FROM pg_proc WHERE proname IN ('set_user_roles', 'admin_create_user', 'admin_change_password', 'handle_new_user')) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.fname || ' CASCADE';
    END LOOP;
END $$;

DROP TYPE IF EXISTS public.user_role CASCADE;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create 'user_role' enum and 'member_profiles' table linked to auth.users
CREATE TYPE public.user_role AS ENUM ('user', 'core_member', 'admin');

CREATE TABLE public.member_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.user_role DEFAULT 'user',
    full_name TEXT,
    registration_number TEXT,
    phone_number TEXT,
    department TEXT,
    year_of_study TEXT,
    is_onboarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on member_profiles
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read profiles"
    ON public.member_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service_role full access to profiles"
    ON public.member_profiles TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow users to update their own profiles"
    ON public.member_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Function to handle new user signups and create a profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.member_profiles (id, email, role)
    VALUES (new.id, new.email, 'user');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SECURE RPC: Allow Admins to elevate others
CREATE OR REPLACE FUNCTION public.set_user_roles(target_user_id UUID, new_role public.user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    caller_role public.user_role;
BEGIN
    SELECT role INTO caller_role FROM public.member_profiles WHERE id = auth.uid();
    IF caller_role != 'admin' THEN RAISE EXCEPTION 'Access Denied: Only admins can update roles.'; END IF;
    IF new_role = 'admin' THEN RAISE EXCEPTION 'Access Denied: Admins cannot assign the admin role to others.'; END IF;
    UPDATE public.member_profiles SET role = new_role WHERE id = target_user_id;
END;
$$;

-- SECURE RPC: Admin Change Password
CREATE OR REPLACE FUNCTION public.admin_change_password(target_user_id UUID, new_password TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    caller_role public.user_role;
BEGIN
    SELECT role INTO caller_role FROM public.member_profiles WHERE id = auth.uid();
    IF caller_role != 'admin' THEN RAISE EXCEPTION 'Access Denied: Only admins can change passwords.'; END IF;
    UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() WHERE id = target_user_id;
END;
$$;

-- SECURE RPC: Admin Create User
CREATE OR REPLACE FUNCTION public.admin_create_user(new_email TEXT, new_password TEXT, initial_role public.user_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    caller_role public.user_role;
    new_user_id UUID;
BEGIN
    SELECT role INTO caller_role FROM public.member_profiles WHERE id = auth.uid();
    IF caller_role != 'admin' THEN RAISE EXCEPTION 'Access Denied: Only admins can create users.'; END IF;
    IF initial_role = 'admin' THEN RAISE EXCEPTION 'Access Denied: Admins cannot create new admin accounts.'; END IF;

    new_user_id := uuid_generate_v4();
    INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        new_user_id, 'authenticated', 'authenticated', new_email, crypt(new_password, gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
    );

    UPDATE public.member_profiles SET role = initial_role WHERE id = new_user_id;
    RETURN new_user_id;
END;
$$;

-- 2. Create 'events' table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL, description TEXT, date_start TIMESTAMP WITH TIME ZONE,
    date_end TIMESTAMP WITH TIME ZONE, location TEXT, image_url TEXT, status TEXT DEFAULT 'upcoming', 
    type TEXT DEFAULT 'event', created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to events" ON public.events FOR SELECT TO public USING (true);
CREATE POLICY "Allow core members to manage events" ON public.events 
    USING (EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member')));

-- 3. Create 'teams' table for hackathon matchmaking
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL, leader_id UUID REFERENCES public.member_profiles(id) ON DELETE CASCADE,
    members UUID[] DEFAULT '{}', project_pitch TEXT, looking_for_members BOOLEAN DEFAULT true,
    pending_requests UUID[] DEFAULT '{}', sent_invites UUID[] DEFAULT '{}', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated to read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow members and leader to update team" ON public.teams FOR UPDATE TO authenticated
    USING (auth.uid() = leader_id OR auth.uid() = ANY(members));
CREATE POLICY "Allow users to insert team" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = leader_id);

-- 4. Create 'registrations' table for QR check-ins
CREATE TABLE public.registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES public.member_profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE, hash_payload TEXT NOT NULL UNIQUE,
    checked_in BOOLEAN DEFAULT false, created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, event_id)
);

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to see their own registrations" ON public.registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow core members to see all registrations" ON public.registrations FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member')));
CREATE POLICY "Allow core members to update registrations" ON public.registrations FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member')));
CREATE POLICY "Allow users to insert their own registrations" ON public.registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5. Create 'team_members' table for the public team directory
CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    category TEXT DEFAULT 'team',
    image_url TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to team_members" ON public.team_members FOR SELECT TO public USING (true);
CREATE POLICY "Allow core members to manage team_members" ON public.team_members 
    USING (EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member')));

-- 6. Storage Policies (Bucket assumed to already exist)
DROP POLICY IF EXISTS "Allow public read access to images bucket" ON storage.objects;
CREATE POLICY "Allow public read access to images bucket" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'images');

DROP POLICY IF EXISTS "Allow core members to upload images" ON storage.objects;
CREATE POLICY "Allow core members to upload images" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'images' AND 
        EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member'))
    );

DROP POLICY IF EXISTS "Allow core members to update images" ON storage.objects;
CREATE POLICY "Allow core members to update images" ON storage.objects
    FOR UPDATE TO authenticated USING (
        bucket_id = 'images' AND 
        EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member'))
    );

DROP POLICY IF EXISTS "Allow core members to delete images" ON storage.objects;
CREATE POLICY "Allow core members to delete images" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'images' AND 
        EXISTS (SELECT 1 FROM public.member_profiles WHERE id = auth.uid() AND role IN ('admin', 'core_member'))
    );
