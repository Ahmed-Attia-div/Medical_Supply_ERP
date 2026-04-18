@echo off
curl -X POST "https://bqfsrpqktgknswujqqup.supabase.co/rest/v1/rpc/create_new_user" ^
-H "apikey: %VITE_SUPABASE_ANON_KEY%" ^
-H "Authorization: Bearer %VITE_SUPABASE_ANON_KEY%" ^
-H "Content-Type: application/json" ^
-d "{\"p_email\":\"test999@test.com\",\"p_password\":\"123\",\"p_name\":\"test\",\"p_role\":\"storekeeper\",\"p_phone\":\"\"}"
