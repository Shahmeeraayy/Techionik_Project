ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS internal_notes TEXT;
