-- Reset e carga de teste para a promocao "Selecao dos Herois"
-- Execute no Supabase SQL Editor quando quiser zerar a base de testes.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT;

TRUNCATE TABLE public.validations RESTART IDENTITY;
TRUNCATE TABLE public.coupons RESTART IDENTITY;

INSERT INTO public.coupons (
  code,
  cpf,
  document_number,
  discount_percentage,
  category,
  expiry_date,
  is_used
) VALUES
  ('HEROI-123-01', '12345678909', 'DOC-123-01', 10, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-123-02', '12345678909', 'DOC-123-02', 10, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-123-03', '12345678909', 'DOC-123-03', 10, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-123-04', '12345678909', 'DOC-123-04', 10, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-123-05', '12345678909', 'DOC-123-05', 10, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-987-01', '98765432100', 'DOC-987-01', 15, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-987-02', '98765432100', 'DOC-987-02', 15, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-987-03', '98765432100', 'DOC-987-03', 15, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-987-04', '98765432100', 'DOC-987-04', 15, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-987-05', '98765432100', 'DOC-987-05', 15, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-111-01', '11144477735', 'DOC-111-01', 20, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-111-02', '11144477735', 'DOC-111-02', 20, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-111-03', '11144477735', 'DOC-111-03', 20, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-111-04', '11144477735', 'DOC-111-04', 20, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-111-05', '11144477735', 'DOC-111-05', 20, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-3748-01', '12873843748', 'DOC-3748-01', 25, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-3748-02', '12873843748', 'DOC-3748-02', 25, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-3748-03', '12873843748', 'DOC-3748-03', 25, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-3748-04', '12873843748', 'DOC-3748-04', 25, 'Selecao dos Herois', '2026-12-31', false),
  ('HEROI-3748-05', '12873843748', 'DOC-3748-05', 25, 'Selecao dos Herois', '2026-12-31', false);

SELECT cpf, code, document_number, is_used
FROM public.coupons
ORDER BY cpf, code;
