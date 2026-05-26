-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'professional_stamps_profissional_id_fkey' 
        AND table_name = 'professional_stamps'
    ) THEN
        ALTER TABLE public.professional_stamps 
        ADD CONSTRAINT professional_stamps_profissional_id_fkey 
        FOREIGN KEY (profissional_id) REFERENCES public.professionals(id) ON DELETE CASCADE;
    END IF;
END $$;
