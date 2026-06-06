-- We will alter the existing teams table to support our automated matchmaking

-- 1. Add registration_id to tightly couple the team with their actual ticket
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE;

-- 2. Add structural capacities
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS max_team_size INTEGER DEFAULT 1;

-- 3. Add Leader Details directly to the team row so the Discord Webhook can read them easily
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS leader_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS leader_email TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS leader_branch TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS leader_year TEXT;

-- 4. Enable Public Read Access to the teams table so the Find a Team tab can fetch it easily
DROP POLICY IF EXISTS "Allow public to read open teams" ON public.teams;
CREATE POLICY "Allow public to read open teams" ON public.teams FOR SELECT TO public USING (looking_for_members = true);

-- Note: We are keeping looking_for_members (BOOLEAN) which already exists.
