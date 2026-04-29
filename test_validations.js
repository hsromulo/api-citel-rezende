import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://tgxhpskqcphlkbrrwubr.supabase.co', 'sb_publishable_lsG8-_TbCJOD9_UhDEKs2A_JGCXGF9s');

(async () => {
  const { data, error } = await supabase.from('coupon_validations').select('*');
  if (error) {
    console.error('❌ Tabela não existe ainda:', error.message);
    console.log('Execute o SQL no Supabase primeiro!');
  } else {
    console.log('✅ Tabela criada! Validações registradas:', data.length);
    if (data.length > 0) {
      console.log('Últimas validações:');
      data.slice(-3).forEach(v => console.log(`- ${v.coupon_code} (${v.document})`));
    }
  }
})();