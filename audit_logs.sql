-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    details JSONB
);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users with 'admin' role to read audit logs
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM member_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow the service role to insert logs (this will be done via Server Actions)
-- We don't want clients inserting logs directly for security reasons
-- But we can allow authenticated users to insert their own logs if needed.
-- Since our server actions use a service key or the authenticated client, let's allow inserts from authenticated users if they are admin or core.
CREATE POLICY "Admins and Core can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM member_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'core_member')
        )
    );
