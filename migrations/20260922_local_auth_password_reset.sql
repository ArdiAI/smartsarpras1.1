-- Smart Sarpras local authentication migration
-- Keeps application login independent from Supabase Auth.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.app_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  requested_ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS app_password_reset_tokens_user_active_idx
  ON private.app_password_reset_tokens (user_id, expires_at)
  WHERE used_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_key
  ON public.app_users ((lower(email)));

INSERT INTO public.app_users (
  id,
  email,
  password_hash,
  name,
  is_active,
  created_at,
  updated_at
)
SELECT
  COALESCE(au.user_id, au.id),
  lower(trim(au.email)),
  'reset-required$' || gen_random_uuid()::text,
  COALESCE(NULLIF(trim(au.name), ''), lower(trim(au.email))),
  true,
  now(),
  now()
FROM public.admin_users au
WHERE au.is_active = true
  AND trim(COALESCE(au.email, '')) <> ''
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = now();

UPDATE public.admin_users au
SET user_id = app.id
FROM public.app_users app
WHERE au.user_id IS NULL
  AND lower(trim(au.email)) = lower(trim(app.email));

UPDATE public.app_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL;
