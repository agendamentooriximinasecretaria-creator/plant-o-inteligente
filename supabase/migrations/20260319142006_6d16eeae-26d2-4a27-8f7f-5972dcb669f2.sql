
-- Fix FK constraints to allow shift deletion
ALTER TABLE shift_swaps DROP CONSTRAINT IF EXISTS shift_swaps_shift_id_fkey;
ALTER TABLE shift_swaps ADD CONSTRAINT shift_swaps_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;

ALTER TABLE shift_swaps DROP CONSTRAINT IF EXISTS shift_swaps_shift_id_destino_fkey;
ALTER TABLE shift_swaps ADD CONSTRAINT shift_swaps_shift_id_destino_fkey FOREIGN KEY (shift_id_destino) REFERENCES shifts(id) ON DELETE SET NULL;

-- Make shift_id nullable since ON DELETE SET NULL requires it
ALTER TABLE shift_swaps ALTER COLUMN shift_id DROP NOT NULL;

-- Change default shift status to confirmado
ALTER TABLE shifts ALTER COLUMN status SET DEFAULT 'confirmado'::shift_status;

-- Update existing agendado shifts with future dates to confirmado
UPDATE shifts SET status = 'confirmado' WHERE status = 'agendado' AND data >= CURRENT_DATE;
