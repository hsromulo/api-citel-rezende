-- Campos adicionais vindos da consulta detalhada do Autcom.
-- Execute no Supabase SQL Editor antes de rodar /sync novamente.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS seller_code TEXT,
  ADD COLUMN IF NOT EXISTS seller_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_mobile TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS customer_zipcode TEXT,
  ADD COLUMN IF NOT EXISTS document_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS sale_date TEXT,
  ADD COLUMN IF NOT EXISTS sale_time TEXT;

CREATE INDEX IF NOT EXISTS idx_coupons_customer_name ON public.coupons(customer_name);
CREATE INDEX IF NOT EXISTS idx_coupons_seller_code ON public.coupons(seller_code);
