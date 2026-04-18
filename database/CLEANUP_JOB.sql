-- OPTION 1: Using pg_cron (Recommended if available)
-- This requires the pg_cron extension to be enabled in your Supabase project.

-- 1. Enable extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the job (Runs at 00:00 on the 1st of every month)
SELECT cron.schedule(
    'cleanup_old_notifications',
    '0 0 1 * *', 
    $$DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days'$$
);

-- OPTION 2: If pg_cron is not available
-- You can create a Database Function and call it via a button or external cron (e.g., GitHub Actions, Vercel Cron).

CREATE OR REPLACE FUNCTION cleanup_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;
