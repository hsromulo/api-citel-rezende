import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AuthUser = {
  id: string;
  email: string;
};

export type CustomerCoupon = {
  id: string;
  code: string;
  cpf: string;
  documentNumber: string;
  documentType?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  sellerCode?: string | null;
  sellerName?: string | null;
  customerPhone?: string | null;
  customerMobile?: string | null;
  customerAddress?: string | null;
  customerNeighborhood?: string | null;
  customerZipcode?: string | null;
  documentAmount?: number | null;
  saleDate?: string | null;
  saleTime?: string | null;
  createdAt?: string | null;
  isUsed: boolean;
  isDrawn?: boolean;
  drawnAt?: string | null;
  prizeItem?: string | null;
  category?: string | null;
  discountPercentage?: number | null;
  expiryDate?: string | null;
};

export type CustomerCouponLookup = {
  success: boolean;
  message?: string;
  coupons: CustomerCoupon[];
  customerName?: string;
  customerCode?: string;
  source: 'validation' | 'mock' | 'supabase';
};

const useLocalTestCoupons = false;

export const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9, 11)}`;
};

export const isValidCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, '');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  let rest;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i), 10) * (11 - i);
  }

  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10), 10)) return false;

  sum = 0;

  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i), 10) * (12 - i);
  }

  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;

  return rest === parseInt(cpf.substring(10, 11), 10);
};

const buildMockCoupons = (cpf: string): CustomerCoupon[] => {
  const suffix = cpf.slice(-4);

  return [
    {
      id: `${cpf}-1`,
      code: `HEROI-${suffix}-01`,
      cpf,
      documentNumber: `DOC-${suffix}-01`,
      documentType: 'TESTE',
      customerCode: null,
      customerName: null,
      sellerCode: null,
      sellerName: null,
      customerPhone: null,
      customerMobile: null,
      customerAddress: null,
      customerNeighborhood: null,
      customerZipcode: null,
      documentAmount: null,
      saleDate: null,
      saleTime: null,
      createdAt: null,
      isUsed: false,
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: 'Seleção dos Heróis',
      discountPercentage: 10,
      expiryDate: '2026-12-31',
    },
    {
      id: `${cpf}-2`,
      code: `HEROI-${suffix}-02`,
      cpf,
      documentNumber: `DOC-${suffix}-02`,
      documentType: 'TESTE',
      customerCode: null,
      customerName: null,
      sellerCode: null,
      sellerName: null,
      customerPhone: null,
      customerMobile: null,
      customerAddress: null,
      customerNeighborhood: null,
      customerZipcode: null,
      documentAmount: null,
      saleDate: null,
      saleTime: null,
      createdAt: null,
      isUsed: false,
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: 'Seleção dos Heróis',
      discountPercentage: 15,
      expiryDate: '2026-12-31',
    },
    {
      id: `${cpf}-3`,
      code: `HEROI-${suffix}-03`,
      cpf,
      documentNumber: `DOC-${suffix}-03`,
      documentType: 'TESTE',
      customerCode: null,
      customerName: null,
      sellerCode: null,
      sellerName: null,
      customerPhone: null,
      customerMobile: null,
      customerAddress: null,
      customerNeighborhood: null,
      customerZipcode: null,
      documentAmount: null,
      saleDate: null,
      saleTime: null,
      createdAt: null,
      isUsed: false,
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: 'Seleção dos Heróis',
      discountPercentage: 15,
      expiryDate: '2026-12-31',
    },
    {
      id: `${cpf}-4`,
      code: `HEROI-${suffix}-04`,
      cpf,
      documentNumber: `DOC-${suffix}-04`,
      documentType: 'TESTE',
      customerCode: null,
      customerName: null,
      sellerCode: null,
      sellerName: null,
      customerPhone: null,
      customerMobile: null,
      customerAddress: null,
      customerNeighborhood: null,
      customerZipcode: null,
      documentAmount: null,
      saleDate: null,
      saleTime: null,
      createdAt: null,
      isUsed: false,
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: 'Seleção dos Heróis',
      discountPercentage: 20,
      expiryDate: '2026-12-31',
    },
    {
      id: `${cpf}-5`,
      code: `HEROI-${suffix}-05`,
      cpf,
      documentNumber: `DOC-${suffix}-05`,
      documentType: 'TESTE',
      customerCode: null,
      customerName: null,
      sellerCode: null,
      sellerName: null,
      customerPhone: null,
      customerMobile: null,
      customerAddress: null,
      customerNeighborhood: null,
      customerZipcode: null,
      documentAmount: null,
      saleDate: null,
      saleTime: null,
      createdAt: null,
      isUsed: false,
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: 'Seleção dos Heróis',
      discountPercentage: 25,
      expiryDate: '2026-12-31',
    },
  ];
};

const buildSyncedCoupons = (cpf: string, couponCount: number): CustomerCoupon[] => {
  const suffix = cpf.slice(-4);
  const safeCouponCount = Math.max(0, Math.floor(couponCount));

  return Array.from({ length: safeCouponCount }, (_, index) => {
    const couponNumber = String(index + 1).padStart(2, '0');

    return {
      id: `${cpf}-${couponNumber}`,
      code: `HEROI-${suffix}-${couponNumber}`,
      cpf,
      documentNumber: `AUTCOM-${suffix}-${couponNumber}`,
      documentType: 'AUTCOM',
      customerCode: null,
      customerName: null,
      sellerCode: null,
      sellerName: null,
      customerPhone: null,
      customerMobile: null,
      customerAddress: null,
      customerNeighborhood: null,
      customerZipcode: null,
      documentAmount: null,
      saleDate: null,
      saleTime: null,
      createdAt: null,
      isUsed: false,
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: 'Seleção dos Heróis',
      discountPercentage: null,
      expiryDate: '2026-12-31',
    };
  });
};

const getValidationKey = (code: string, documentNumber: string) =>
  `${code.replace(/\D/g, '')}:${documentNumber.replace(/\D/g, '')}`;

const normalizeNumericId = (value: string) =>
  value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const getNormalizedValidationKey = (code: string, documentNumber: string) =>
  `${normalizeNumericId(code)}:${normalizeNumericId(documentNumber)}`;

const getCouponDrawKey = (code: string) => normalizeNumericId(code);

const isSameCpfOrMissing = (value: string | null | undefined, cleanCpf: string) => {
  const drawCpf = String(value ?? '').replace(/\D/g, '');

  return !drawCpf || drawCpf === cleanCpf;
};

const markCouponAsUsed = async (
  couponCode: string,
  documentNumber: string,
  cpf?: string
) => {
  const cleanCoupon = couponCode.replace(/\D/g, '');
  const cleanDocument = documentNumber.replace(/\D/g, '');
  const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';

  let query = supabase
    .from('coupons')
    .update({
      is_used: true,
      used_at: new Date().toISOString(),
    })
    .eq('code', cleanCoupon)
    .eq('document_number', cleanDocument);

  if (cleanCpf) {
    query = query.eq('cpf', cleanCpf);
  }

  const { error } = await query;

  if (error) {
    console.warn('Nao foi possivel marcar o cupom como usado:', error);
  }
};

const validationAlreadyExists = async (
  cleanCoupon: string,
  cleanDocument: string,
  cleanCpf: string
) => {
  let query = supabase
    .from('validations')
    .select('id')
    .eq('code', cleanCoupon)
    .eq('document', cleanDocument);

  if (cleanCpf) {
    query = query.eq('cpf', cleanCpf);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn('Nao foi possivel confirmar validacao existente:', error);
    return false;
  }

  return Boolean(data);
};

const getValidatedCouponKeys = async (
  cleanCpf: string,
  coupons: Array<{ code: string; documentNumber: string }>
) => {
  const codes = Array.from(
    new Set(
      coupons
        .flatMap((coupon) => [
          coupon.code.replace(/\D/g, ''),
          normalizeNumericId(coupon.code),
        ])
        .filter(Boolean)
    )
  );

  if (codes.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from('validations')
    .select('code, document, cpf')
    .eq('cpf', cleanCpf)
    .in('code', codes);

  if (error || !data) {
    if (error) {
      console.warn('Nao foi possivel consultar validacoes existentes:', error);
    }
    return new Set<string>();
  }

  return new Set(
    data.map((item) =>
      getValidationKey(String(item.code ?? ''), String(item.document ?? ''))
    )
  );
};

const getDrawnCouponMap = async (
  cleanCpf: string,
  coupons: Array<{ code: string; documentNumber: string }>
) => {
  const codes = Array.from(
    new Set(
      coupons
        .flatMap((coupon) => [
          coupon.code.replace(/\D/g, ''),
          normalizeNumericId(coupon.code),
        ])
        .filter(Boolean)
    )
  );

  if (codes.length === 0) {
    return new Map<string, { drawnAt: string | null; prizeItem: string | null }>();
  }

  const { data, error } = await supabase
    .from('draws')
    .select('code, document, cpf, drawn_at, prize_item')
    .in('code', codes);

  if (error || !data) {
    if (error && error.code !== '42P01') {
      console.warn('Nao foi possivel consultar sorteios existentes:', error);
    }
    return new Map<string, { drawnAt: string | null; prizeItem: string | null }>();
  }

  return new Map(
    data.filter((item) => isSameCpfOrMissing(item.cpf, cleanCpf)).flatMap((item) => {
      const drawData = {
        drawnAt: item.drawn_at ? String(item.drawn_at) : null,
        prizeItem: item.prize_item ? String(item.prize_item) : null,
      };
      const code = String(item.code ?? '');
      const document = String(item.document ?? '');

      return [
        [getValidationKey(code, document), drawData],
        [getNormalizedValidationKey(code, document), drawData],
      ] as Array<[string, { drawnAt: string | null; prizeItem: string | null }]>;
    })
  );
};

const getDrawnCouponByCodeMap = async (
  cleanCpf: string,
  coupons: Array<{ code: string }>
) => {
  const codes = coupons
    .map((coupon) => coupon.code.replace(/\D/g, ''))
    .filter(Boolean);

  if (codes.length === 0) {
    return new Map<string, { drawnAt: string | null; prizeItem: string | null }>();
  }

  const { data, error } = await supabase
    .from('draws')
    .select('code, cpf, drawn_at, prize_item')
    .in('code', codes);

  if (error || !data) {
    if (error && error.code !== '42P01') {
      console.warn('Nao foi possivel consultar sorteios por cupom:', error);
    }
    return new Map<string, { drawnAt: string | null; prizeItem: string | null }>();
  }

  return new Map(
    data
      .filter((item) => isSameCpfOrMissing(item.cpf, cleanCpf))
      .map((item) => [
        getCouponDrawKey(String(item.code ?? '')),
        {
          drawnAt: item.drawn_at ? String(item.drawn_at) : null,
          prizeItem: item.prize_item ? String(item.prize_item) : null,
        },
      ])
  );
};

const enrichCouponsWithValidationAndDrawStatus = async (
  cleanCpf: string,
  coupons: CustomerCoupon[]
) => {
  const validatedKeys = await getValidatedCouponKeys(cleanCpf, coupons);
  const drawnCouponMap = await getDrawnCouponMap(cleanCpf, coupons);
  const drawnCouponByCodeMap = await getDrawnCouponByCodeMap(cleanCpf, coupons);

  return coupons.map((coupon) => {
    const exactKey = getValidationKey(coupon.code, coupon.documentNumber);
    const normalizedKey = getNormalizedValidationKey(
      coupon.code,
      coupon.documentNumber
    );
    const codeKey = getCouponDrawKey(coupon.code);
    const drawData =
      drawnCouponMap.get(exactKey) ??
      drawnCouponMap.get(normalizedKey) ??
      drawnCouponByCodeMap.get(codeKey) ??
      null;

    return {
      ...coupon,
      isUsed: coupon.isUsed || validatedKeys.has(exactKey),
      isDrawn: Boolean(drawData),
      drawnAt: drawData?.drawnAt ?? null,
      prizeItem: drawData?.prizeItem ?? null,
    };
  });
};

export const validateCoupon = async (
  couponCode: string,
  documentNumber: string,
  cpf?: string
) => {
  if (useLocalTestCoupons && couponCode.startsWith('HEROI-')) {
    return {
      success: true,
      id: `${cpf ?? 'teste'}-${couponCode}`,
      message: 'Cupom validado com sucesso!',
    };
  }

  const cleanCoupon = couponCode.replace(/\D/g, '');
  const cleanDocument = documentNumber.replace(/\D/g, '');
  const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';

  if (!cleanCoupon) {
    return {
      success: false,
      message: 'Selecione um cupom válido.',
    };
  }

  if (!cleanDocument) {
    return {
      success: false,
      message: 'Documento inválido para este cupom.',
    };
  }

  if (cleanCpf && cleanCpf.length !== 11) {
    return {
      success: false,
      message: 'CPF inválido. Digite um CPF com 11 números.',
    };
  }

  const { data, error } = await supabase
    .from('validations')
    .insert([
      {
        code: cleanCoupon,
        document: cleanDocument,
        cpf: cleanCpf,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Erro real do Supabase:', error);

    if (
      error.message?.toLowerCase().includes('duplicate') ||
      error.message?.toLowerCase().includes('unique')
    ) {
      const exactValidationExists = await validationAlreadyExists(
        cleanCoupon,
        cleanDocument,
        cleanCpf
      );

      if (!exactValidationExists) {
        return {
          success: false,
          message:
            'O banco bloqueou este cupom por uma restricao antiga. Rode o SQL fix_validations_unique_coupon.sql no Supabase e tente novamente.',
        };
      }

      await markCouponAsUsed(cleanCoupon, cleanDocument, cleanCpf);
      return {
        success: true,
        id: `${cleanCoupon}-${cleanDocument}`,
        message: 'Este documento já foi validado anteriormente.',
      };
    }

    return {
      success: false,
      message: error.message || 'Erro ao salvar no banco.',
    };
  }

  await markCouponAsUsed(cleanCoupon, cleanDocument, cleanCpf);

  return {
    success: true,
    id: data?.id ?? '',
    message: 'Cupom validado com sucesso!',
  };
};

export const getCouponsByCpf = async (cpf: string): Promise<CustomerCouponLookup> => {
  const cleanCpf = cpf.replace(/\D/g, '');

  if (cleanCpf.length !== 11) {
    return {
      success: false,
      message: 'CPF inválido. Digite um CPF com 11 números.',
      coupons: [] as CustomerCoupon[],
      source: 'validation' as const,
    };
  }

  if (useLocalTestCoupons) {
    return {
      success: true,
      coupons: buildMockCoupons(cleanCpf),
      source: 'mock' as const,
    };
  }

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('cpf', cleanCpf)
    .order('created_at', { ascending: false });

  if (!error && data && data.length > 0) {
    const coupons = data.map((item) => ({
      id: String(item.id ?? ''),
      code: String(item.code ?? ''),
      cpf: String(item.cpf ?? cleanCpf),
      documentNumber: String(item.document_number ?? item.document ?? ''),
      documentType: item.document_type ?? null,
      customerCode: item.customer_code ?? null,
      customerName: item.customer_name ?? null,
      sellerCode: item.seller_code ?? null,
      sellerName: item.seller_name ?? null,
      customerPhone: item.customer_phone ?? null,
      customerMobile: item.customer_mobile ?? null,
      customerAddress: item.customer_address ?? null,
      customerNeighborhood: item.customer_neighborhood ?? null,
      customerZipcode: item.customer_zipcode ?? null,
      documentAmount:
        typeof item.document_amount === 'number'
          ? item.document_amount
          : item.document_amount
            ? Number(item.document_amount)
            : null,
      saleDate: item.sale_date ?? null,
      saleTime: item.sale_time ?? null,
      createdAt: item.created_at ?? null,
      isUsed: Boolean(item.is_used),
      isDrawn: false,
      drawnAt: null,
      prizeItem: null,
      category: item.category ?? null,
      discountPercentage:
        typeof item.discount_percentage === 'number'
          ? item.discount_percentage
          : null,
      expiryDate: item.expiry_date ?? null,
    }));

    const couponsWithValidationStatus =
      await enrichCouponsWithValidationAndDrawStatus(cleanCpf, coupons);

    return {
      success: true,
      coupons: couponsWithValidationStatus,
      source: 'supabase' as const,
    };
  }

  const { data: clientCoupon, error: clientCouponError } = await supabase
    .from('client_coupons')
    .select('*')
    .eq('cpf', cleanCpf)
    .maybeSingle();

  if (!clientCouponError && clientCoupon) {
    const coupons = buildSyncedCoupons(
      cleanCpf,
      Number(clientCoupon.cupons_disponiveis ?? 0)
    );

    if (coupons.length === 0) {
      return {
        success: true,
        message:
          'Você ainda não possui cupons nesta promoção. Compre produtos participantes para entrar na promoção e aumentar suas chances no sorteio.',
        coupons: [] as CustomerCoupon[],
        customerName: String(clientCoupon.customer_name ?? ''),
        customerCode: String(clientCoupon.customer_code ?? ''),
        source: 'supabase' as const,
      };
    }

    const couponsWithValidationStatus =
      await enrichCouponsWithValidationAndDrawStatus(cleanCpf, coupons);

    return {
      success: true,
      coupons: couponsWithValidationStatus,
      source: 'supabase' as const,
    };
  }

  if (error) {
    console.warn('Busca em client_coupons/coupons indisponível:', {
      clientCouponError,
      couponError: error,
    });

    return {
      success: false,
      message: 'Não foi possível consultar este CPF no banco de dados.',
      coupons: [] as CustomerCoupon[],
      source: 'supabase' as const,
    };
  }

  return {
    success: false,
    coupons: [] as CustomerCoupon[],
    source: 'supabase' as const,
    message: 'CPF não localizado ou sem cupons disponíveis.',
  };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    user: data.user,
  };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Erro ao sair:', error);
    return false;
  }

  return true;
};

export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getUser();

  if (!data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email || '',
  };
};

export const onAuthStateChange = (callback: (user: AuthUser | null) => void) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email || '',
      });
    } else {
      callback(null);
    }
  });

  return () => {
    data.subscription.unsubscribe();
  };
};
