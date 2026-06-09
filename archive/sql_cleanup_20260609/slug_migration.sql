-- 1. Add the slug column
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Backfill existing events with a basic slug (title + short random hash)
UPDATE events 
SET slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(md5(random()::text) from 1 for 4)
WHERE slug IS NULL;

-- 3. Make it NOT NULL for future inserts
ALTER TABLE events ALTER COLUMN slug SET NOT NULL;
