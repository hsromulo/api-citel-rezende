-- Corrige a restricao da tabela de validacoes para permitir mais de um cupom
-- no mesmo documento, desde que o codigo do cupom seja diferente.
--
-- Execute este arquivo no SQL Editor do Supabase.

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.validations'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.validations DROP CONSTRAINT IF EXISTS %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.validations_unique_coupon_document_cpf;
DROP INDEX IF EXISTS public.validations_code_document_cpf_key;

CREATE UNIQUE INDEX IF NOT EXISTS validations_unique_coupon_document_cpf
  ON public.validations (code, document, cpf);

CREATE INDEX IF NOT EXISTS idx_validations_code
  ON public.validations (code);

CREATE INDEX IF NOT EXISTS idx_validations_document
  ON public.validations (document);

CREATE INDEX IF NOT EXISTS idx_validations_cpf
  ON public.validations (cpf);

-- Recupera cupons que foram marcados como usados em public.coupons,
-- mas nao chegaram a entrar em public.validations por causa da restricao antiga.
INSERT INTO public.validations (code, cpf, document, validated_at)
SELECT
  c.code,
  c.cpf,
  c.document_number,
  COALESCE(c.used_at, NOW())
FROM public.coupons c
LEFT JOIN public.validations v
  ON v.code = c.code
  AND v.document = c.document_number
  AND v.cpf = c.cpf
WHERE c.is_used = TRUE
  AND v.id IS NULL;
