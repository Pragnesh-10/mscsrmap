-- 1. Enable the pg_net extension for network requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the Webhook Trigger Function
CREATE OR REPLACE FUNCTION public.broadcast_team_seeking_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  -- Construct the payload to match what Supabase Webhooks normally send
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE null END
  );

  -- Send the HTTP POST request to the local Edge Function
  -- Note: In production, you would change this URL to your deployed Edge Function URL.
  SELECT net.http_post(
      url:='http://host.docker.internal:54321/functions/v1/discord-broadcast',
      body:=payload,
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) INTO request_id;

  RETURN NEW;
END;
$$;

-- 3. Attach the Trigger to the teams table
DROP TRIGGER IF EXISTS on_team_seeking_members ON public.teams;
CREATE TRIGGER on_team_seeking_members
  AFTER INSERT OR UPDATE
  ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_team_seeking_members();
