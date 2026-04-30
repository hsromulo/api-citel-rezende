CREATE TABLE IF NOT EXISTS public.draws (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_id UUID,
  prize_item TEXT,
  code TEXT NOT NULL,
  cpf TEXT,
  document TEXT,
  document_type TEXT,
  customer_code TEXT,
  customer_name TEXT,
  seller_code TEXT,
  seller_name TEXT,
  validated_at TIMESTAMP WITH TIME ZONE,
  algorithm_version TEXT NOT NULL DEFAULT 'crypto-random-v1',
  pool_size INTEGER NOT NULL,
  random_value TEXT NOT NULL,
  selected_index INTEGER NOT NULL,
  participants_hash TEXT,
  drawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS prize_item TEXT;

ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS participants_hash TEXT;

DROP POLICY IF EXISTS "Allow authenticated reads on draws" ON public.draws;
CREATE POLICY "Allow authenticated reads on draws"
  ON public.draws
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated inserts on draws" ON public.draws;
CREATE POLICY "Allow authenticated inserts on draws"
  ON public.draws
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow public reads on draws" ON public.draws;
CREATE POLICY "Allow public reads on draws"
  ON public.draws
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_draws_drawn_at ON public.draws(drawn_at);
CREATE INDEX IF NOT EXISTS idx_draws_code ON public.draws(code);
CREATE INDEX IF NOT EXISTS idx_draws_cpf ON public.draws(cpf);
CREATE INDEX IF NOT EXISTS idx_draws_participants_hash ON public.draws(participants_hash);

CREATE TABLE IF NOT EXISTS public.draw_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  algorithm_version TEXT NOT NULL,
  algorithm_updated_at DATE NOT NULL,
  commit_hash TEXT,
  pool_size INTEGER NOT NULL,
  selected_index INTEGER NOT NULL,
  random_value TEXT NOT NULL,
  participants_hash TEXT NOT NULL,
  participants JSONB NOT NULL,
  admin_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.draw_audits
  ADD COLUMN IF NOT EXISTS commit_hash TEXT;

ALTER TABLE public.draw_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on draw audits" ON public.draw_audits;
CREATE POLICY "Allow authenticated reads on draw audits"
  ON public.draw_audits
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated inserts on draw audits" ON public.draw_audits;
CREATE POLICY "Allow authenticated inserts on draw audits"
  ON public.draw_audits
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_draw_audits_draw_id ON public.draw_audits(draw_id);
CREATE INDEX IF NOT EXISTS idx_draw_audits_participants_hash ON public.draw_audits(participants_hash);
