/*
# Create System Settings Tables (Pengaturan Sistem)

## Summary
Creates two new tables for the Super Admin "Pengaturan Sistem" page:
1. `system_settings` — a single-row, JSONB-backed key/value store for all
   configurable settings (app identity, landing page content, theme colors,
   audit metadata).  All values read from the database; no hardcode.
2. `system_banners` — carousel/banner rows with image URL, order, and
   active toggle.

These tables are additive only.  No existing tables are modified.

## New Tables

### 1. `system_settings`
- `id` (uuid, primary key)
- `key` (text, unique) — e.g. "app_identity", "landing_page", "theme", "audit"
- `value` (jsonb) — the settings object for that section
- `label` (text) — human-readable section name
- `updated_by` (uuid, nullable, FK → admin_users.id)
- `updated_at` (timestptz)

### 2. `system_banners`
- `id` (uuid, primary key)
- `title` (text)
- `image_url` (text)
- `link_url` (text, nullable)
- `sort_order` (integer, default 0)
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on both tables.
- Public (anon + authenticated) can SELECT so the public site reads settings.
- Only authenticated users can INSERT/UPDATE/DELETE (Super Admin enforced
  at the application layer via the existing permission system).

## Notes
- Default rows are seeded so the page has data on first load.
- The `system_config` table already exists for key/value runtime config;
  these new tables are separate and dedicated to the Pengaturan Sistem page.
*/

-- ============================================================
-- SYSTEM_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  label text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ss_select" ON system_settings;
CREATE POLICY "ss_select" ON system_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ss_insert" ON system_settings;
CREATE POLICY "ss_insert" ON system_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ss_update" ON system_settings;
CREATE POLICY "ss_update" ON system_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ss_delete" ON system_settings;
CREATE POLICY "ss_delete" ON system_settings FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- SYSTEM_BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  link_url text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sb_select" ON system_banners;
CREATE POLICY "sb_select" ON system_banners FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sb_insert" ON system_banners;
CREATE POLICY "sb_insert" ON system_banners FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sb_update" ON system_banners;
CREATE POLICY "sb_update" ON system_banners FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sb_delete" ON system_banners;
CREATE POLICY "sb_delete" ON system_banners FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- SEED: default settings rows
-- ============================================================
INSERT INTO system_settings (key, value, label) VALUES
  (
    'app_identity',
    '{
      "app_name": "Smart Sarpras",
      "app_logo": "",
      "favicon": "",
      "school_name": "SMK Negeri 1 Cimahi",
      "school_logo": "",
      "school_address": "Jl. Mahar Martanegara No.48, Cimahi",
      "school_phone": "(022) 662-1234",
      "school_email": "info@smkn1cimahi.sch.id",
      "school_website": "https://smkn1cimahi.sch.id"
    }'::jsonb,
    'Identitas Aplikasi'
  ),
  (
    'landing_page',
    '{
      "hero_title": "Smart Sarpras",
      "hero_subtitle": "Sistem administrasi sarana dan prasarana sekolah.",
      "hero_image": "",
      "about_text": "Smart Sarpras adalah sistem informasi manajemen sarana dan prasarana sekolah yang membantu pengelolaan inventaris, fasilitas, peminjaman, dan pelaporan kerusakan secara terpadu.",
      "footer_text": "Smart Sarpras - SMK Negeri 1 Cimahi",
      "copyright": "© 2026 Smart Sarpras. Seluruh hak cipta dilindungi."
    }'::jsonb,
    'Landing Page'
  ),
  (
    'theme',
    '{
      "primary_color": "#1e40af",
      "secondary_color": "#0e7490",
      "accent_color": "#f59e0b",
      "logo_light": "",
      "logo_dark": ""
    }'::jsonb,
    'Warna Aplikasi'
  ),
  (
    'audit',
    '{
      "app_version": "1.0.0",
      "last_deploy": "",
      "db_version": "1.0.0"
    }'::jsonb,
    'Audit'
  )
ON CONFLICT (key) DO NOTHING;

-- Seed a couple of default banners so the carousel section isn't empty
INSERT INTO system_banners (title, image_url, sort_order, is_active) VALUES
  ('Selamat Datang di Smart Sarpras', '', 1, true),
  ('Pengajuan Peminjaman Online', '', 2, false)
ON CONFLICT DO NOTHING;
