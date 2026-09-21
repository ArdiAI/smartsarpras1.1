-- Smart Sarpras - Local PostgreSQL authentication
-- Self-contained migration for PostgreSQL sekolah / non-Supabase deployment.
-- Safe to run more than once.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_key
  ON public.app_users ((lower(email)));

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

-- Migrate every active admin into the new local auth table.
-- Existing admin UUIDs are retained where possible so role mappings remain intact.
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

-- Link legacy admin records that did not have user_id.
UPDATE public.admin_users au
SET user_id = app.id
FROM public.app_users app
WHERE au.user_id IS NULL
  AND lower(trim(au.email)) = lower(trim(app.email));

-- Old tokens from another auth provider must never stay active after migration.
UPDATE public.app_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL;
