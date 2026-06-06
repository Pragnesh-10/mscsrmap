-- 1. Add max_capacity to events table (NULL means infinite capacity)
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT NULL;

-- 2. Add status to registrations table (default 'confirmed')
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- 3. Update existing registrations to explicitly be confirmed
UPDATE registrations SET status = 'confirmed' WHERE status IS NULL;
