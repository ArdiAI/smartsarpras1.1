/*
# Add image_url to announcements and contact_phone + surat_url to agendas

1. Changes to `announcements`
- Add `image_url` (text, nullable) — stores the public URL of an optional image attached to an announcement.
   Old announcements without an image will simply have NULL here.

2. Changes to `agendas`
- Add `contact_phone` (text, nullable) — active phone number of the agenda submitter.
   Old agendas without a phone will have NULL here.
- Add `surat_url` (text, nullable) — public URL of an optional borrowing letter uploaded as archive.
   Old agendas without a letter will have NULL here.

3. Security
- No RLS policy changes. Existing policies already allow public read of active announcements
   and admin CRUD. The new columns are covered by the existing policies (column-level privileges
   are not restricted).
*/

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS surat_url text;
