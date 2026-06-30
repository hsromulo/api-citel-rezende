-- Indices para acelerar a consulta de CPF, validacoes e sorteios.
-- Execute este arquivo no SQL Editor do Supabase.

CREATE INDEX IF NOT EXISTS idx_coupons_cpf_code_document
  ON public.coupons(cpf, code, document_number);

CREATE INDEX IF NOT EXISTS idx_client_coupons_cpf
  ON public.client_coupons(cpf);

CREATE INDEX IF NOT EXISTS idx_validations_cpf_code_document
  ON public.validations(cpf, code, document);

CREATE INDEX IF NOT EXISTS idx_validations_code_document
  ON public.validations(code, document);

CREATE INDEX IF NOT EXISTS idx_draws_cpf_code_document
  ON public.draws(cpf, code, document);

CREATE INDEX IF NOT EXISTS idx_draws_code_document
  ON public.draws(code, document);
