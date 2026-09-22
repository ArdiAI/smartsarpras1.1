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
WHERE lower(trim(au.email)) = lower(trim(app.email))
  AND au.user_id IS DISTINCT FROM app.id;

-- Any sessions present before this migration are revoked once.
UPDATE public.app_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL;


-- =====================================================
-- Borrowing guide - required by both public and Super Admin pages
-- Safe for the school/local PostgreSQL deployment.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.borrowing_guide_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text NOT NULL,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  image_file_id text
);

ALTER TABLE public.borrowing_guide_steps
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS image_file_id text;

UPDATE public.borrowing_guide_steps
SET
  sort_order = COALESCE(sort_order, 0),
  is_active = COALESCE(is_active, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

CREATE INDEX IF NOT EXISTS borrowing_guide_steps_public_order_idx
  ON public.borrowing_guide_steps (is_active, sort_order, created_at);
