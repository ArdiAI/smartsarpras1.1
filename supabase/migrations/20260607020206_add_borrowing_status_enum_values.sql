-- Add new borrowing statuses
ALTER TYPE borrowing_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE borrowing_status ADD VALUE IF NOT EXISTS 'cancelled';
