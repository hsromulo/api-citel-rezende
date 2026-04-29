-- Criar tabela para validações de cupons aleatórios
CREATE TABLE IF NOT EXISTS coupon_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_code TEXT NOT NULL,
  document TEXT NOT NULL,
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca por código do cupom
CREATE INDEX IF NOT EXISTS idx_coupon_validations_code ON coupon_validations(coupon_code);

-- Índice para busca por documento
CREATE INDEX IF NOT EXISTS idx_coupon_validations_document ON coupon_validations(document);

-- Política RLS (se necessário, mas para simplicidade, vamos permitir tudo por enquanto)
ALTER TABLE coupon_validations ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserções anônimas (para validação)
CREATE POLICY "Allow anonymous inserts" ON coupon_validations FOR INSERT WITH CHECK (true);

-- Política para permitir leituras para usuários autenticados (admin)
CREATE POLICY "Allow authenticated reads" ON coupon_validations FOR SELECT USING (auth.role() = 'authenticated');