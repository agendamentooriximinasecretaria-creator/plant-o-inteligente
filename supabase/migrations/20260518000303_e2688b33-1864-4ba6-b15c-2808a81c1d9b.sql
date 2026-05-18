
CREATE OR REPLACE FUNCTION public._export_auth_users_tmp()
RETURNS TABLE(id uuid, email text, encrypted_password text, raw_app_meta_data jsonb, raw_user_meta_data jsonb, email_confirmed_at timestamptz, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id, u.email::text, u.encrypted_password::text, u.raw_app_meta_data, u.raw_user_meta_data, u.email_confirmed_at, u.created_at
  FROM auth.users u
  WHERE u.deleted_at IS NULL
  ORDER BY u.created_at;
$$;
REVOKE ALL ON FUNCTION public._export_auth_users_tmp() FROM PUBLIC, anon, authenticated;
