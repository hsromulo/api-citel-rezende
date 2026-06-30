-- Criar tabela de cupons para o sistema de validação
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    cpf TEXT,
    document_number TEXT,
    document_type TEXT,
    customer_code TEXT,
    customer_name TEXT,
    seller_code TEXT,
    seller_name TEXT,
    customer_phone TEXT,
    customer_mobile TEXT,
    customer_address TEXT,
    customer_neighborhood TEXT,
    customer_zipcode TEXT,
    document_amount NUMERIC(12, 2),
    sale_date TEXT,
    sale_time TEXT,
    discount_percentage INTEGER NOT NULL,
    category TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública (para validação)
CREATE POLICY "Allow public read access on coupons" ON public.coupons
    FOR SELECT USING (true);

-- Política para permitir atualização apenas quando não usado
CREATE POLICY "Allow update when not used" ON public.coupons
    FOR UPDATE USING (is_used = false);

CREATE INDEX IF NOT EXISTS idx_coupons_cpf ON public.coupons(cpf);
CREATE INDEX IF NOT EXISTS idx_coupons_document_number ON public.coupons(document_number);
CREATE INDEX IF NOT EXISTS idx_coupons_customer_name ON public.coupons(customer_name);
CREATE INDEX IF NOT EXISTS idx_coupons_seller_code ON public.coupons(seller_code);

-- Inserir alguns cupons de exemplo
INSERT INTO public.coupons (code, discount_percentage, category, expiry_date) VALUES
('CUPOM001', 10, 'Materiais de Construção', '2026-12-31'),
('CUPOM002', 15, 'Ferramentas', '2026-12-31'),
('CUPOM003', 20, 'Tintas', '2026-12-31'),
('CUPOM004', 5, 'Elétrica', '2026-12-31'),
('CUPOM005', 25, 'Hidráulica', '2026-12-31')
ON CONFLICT (code) DO NOTHING;

-- Verificar se os cupons foram inseridos
SELECT * FROM public.coupons;
