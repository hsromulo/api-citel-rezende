#!/usr/bin/env node

// Script para criar a tabela coupons no Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tgxhpskqcphlkbrrwubr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lsG8-_TbCJOD9_UhDEKs2A_JGCXGF9s';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTable() {
  console.log('🔄 Criando tabela coupons no Supabase...');

  try {
    // Criar tabela
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.coupons (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          discount_percentage INTEGER NOT NULL,
          category TEXT NOT NULL,
          expiry_date DATE NOT NULL,
          is_used BOOLEAN DEFAULT FALSE,
          used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (tableError) {
      console.log('❌ Erro ao criar tabela via RPC. Use o painel do Supabase.');
      console.log('📋 Vá para: https://supabase.com/dashboard/project/tgxhpskqcphlkbrrwubr');
      console.log('📋 Menu: SQL Editor > New Query');
      console.log('📋 Cole e execute o SQL do arquivo create_coupons_table.sql');
      return;
    }

    console.log('✅ Tabela criada com sucesso!');

    // Inserir cupons de exemplo
    const coupons = [
      { code: 'CUPOM001', discount_percentage: 10, category: 'Materiais de Construção', expiry_date: '2026-12-31' },
      { code: 'CUPOM002', discount_percentage: 15, category: 'Ferramentas', expiry_date: '2026-12-31' },
      { code: 'CUPOM003', discount_percentage: 20, category: 'Tintas', expiry_date: '2026-12-31' },
      { code: 'CUPOM004', discount_percentage: 5, category: 'Elétrica', expiry_date: '2026-12-31' },
      { code: 'CUPOM005', discount_percentage: 25, category: 'Hidráulica', expiry_date: '2026-12-31' }
    ];

    const { error: insertError } = await supabase
      .from('coupons')
      .insert(coupons);

    if (insertError) {
      console.log('❌ Erro ao inserir cupons:', insertError.message);
    } else {
      console.log('✅ Cupons de exemplo inseridos!');
      console.log('🎯 Códigos disponíveis: CUPOM001, CUPOM002, CUPOM003, CUPOM004, CUPOM005');
    }

    // Verificar se funcionou
    const { data, error: selectError } = await supabase
      .from('coupons')
      .select('*');

    if (selectError) {
      console.log('❌ Erro ao verificar:', selectError.message);
    } else {
      console.log(`✅ ${data.length} cupons na tabela`);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.log('');
    console.log('📋 SOLUÇÃO: Execute manualmente no painel do Supabase');
    console.log('📋 URL: https://supabase.com/dashboard/project/tgxhpskqcphlkbrrwubr');
    console.log('📋 Vá em SQL Editor > New Query');
    console.log('📋 Cole o conteúdo do arquivo create_coupons_table.sql');
  }
}

createTable();