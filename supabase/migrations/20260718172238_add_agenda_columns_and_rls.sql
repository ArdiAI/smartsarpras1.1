-- Add missing columns to agendas table for the Agenda feature
ALTER TABLE agendas
  ADD COLUMN IF NOT EXISTS penyelenggara text DEFAULT '',
  ADD COLUMN IF NOT EXISTS organisasi_jurusan text DEFAULT '',
  ADD COLUMN IF NOT EXISTS penanggung_jawab text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Enable RLS on agendas
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;

-- Public can read agendas (public-facing agenda list)
CREATE POLICY "select_agendas_public" ON agendas
  FOR SELECT TO anon, authenticated USING (true);

-- Authenticated admins can create agendas
CREATE POLICY "insert_agendas_authenticated" ON agendas
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated admins can update agendas
CREATE POLICY "update_agendas_authenticated" ON agendas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Authenticated admins can delete agendas
CREATE POLICY "delete_agendas_authenticated" ON agendas
  FOR DELETE TO authenticated USING (true);
