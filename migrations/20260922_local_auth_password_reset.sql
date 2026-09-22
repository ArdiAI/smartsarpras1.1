-- Smart Sarpras - Local PostgreSQL authentication
-- Self-contained migration for PostgreSQL sekolah / non-Supabase deployment.
-- Safe to run more than once.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_key
  ON public.app_users ((lower(email)));

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_key
  ON public.app_users ((lower(username)))
  WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx
  ON public.app_sessions (user_id);

CREATE INDEX IF NOT EXISTS app_sessions_active_idx
  ON public.app_sessions (expires_at)
  WHERE revoked_at IS NULL;

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

-- Link an existing registered account to a legacy admin record by email.
UPDATE public.admin_users au
SET user_id = app.id
FROM public.app_users app
WHERE au.user_id IS NULL
  AND lower(trim(au.email)) = lower(trim(app.email));

-- Any sessions present before this migration are revoked once.
UPDATE public.app_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL;
