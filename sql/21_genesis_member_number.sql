-- 1. Create sequence for generating unique member numbers
CREATE SEQUENCE IF NOT EXISTS public.genesis_member_seq START WITH 1;

-- 2. Add member_number column to profiles table if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_number INTEGER;

-- 3. Populate existing users first (to ensure no NULLs or duplicates exist when adding constraint)
-- We join with auth.users to get the true registration timestamp (created_at)
WITH ordered_profiles AS (
  SELECT p.id, ROW_NUMBER() OVER (ORDER BY u.created_at ASC) as row_num
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
)
UPDATE public.profiles p
SET member_number = op.row_num
FROM ordered_profiles op
WHERE p.id = op.id AND p.member_number IS NULL;

-- 4. Add unique constraint to member_number (only if it does not already exist as a constraint or index relation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'unique_member_number'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT unique_member_number UNIQUE (member_number);
  END IF;
END;
$$;

-- 5. Adjust the sequence to start from the next available number (MAX + 1)
SELECT setval('public.genesis_member_seq', COALESCE((SELECT MAX(member_number) FROM public.profiles), 0) + 1, false);

-- 6. Create trigger function to automatically assign member_number on insert
CREATE OR REPLACE FUNCTION public.assign_genesis_member_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    NEW.member_number := nextval('public.genesis_member_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Bind trigger to profiles table
DROP TRIGGER IF EXISTS tr_assign_genesis_member_number ON public.profiles;
CREATE TRIGGER tr_assign_genesis_member_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_genesis_member_number();
