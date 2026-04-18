@echo off
set /p SUPABASE_URL=<.env
set SUPABASE_URL=%SUPABASE_URL:VITE_SUPABASE_URL=%
set SUPABASE_KEY=%SUPABASE_URL:VITE_SUPABASE_ANON_KEY=%

rem It's too complex to parse .env in batch, let's write a node script instead to fetch the API error details.
