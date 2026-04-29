-- Campos de identificação do cliente mesmo quando ele ainda não tem cupons.
-- Execute no Supabase SQL Editor antes de rodar /sync novamente.

ALTER TABLE public.client_coupons
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

CREATE INDEX IF NOT EXISTS idx_client_coupons_customer_name
  ON public.client_coupons(customer_name);
