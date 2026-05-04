import { useEffect, useState } from 'react';
import { formatCPF, supabase } from '../services/supabaseService';
import * as XLSX from 'xlsx';
import './CouponList.css';

interface CouponListProps {
  onBack: () => void;
}

interface Validation {
  id: string;
  code: string;
  cpf: string;
  document: string;
  validated_at: string;
  customer_code?: string | null;
  customer_name?: string | null;
  seller_code?: string | null;
  seller_name?: string | null;
  document_type?: string | null;
}

interface DrawRecord extends Validation {
  draw_id: string;
  validation_id?: string | null;
  drawn_at: string;
  prize_item?: string | null;
  algorithm_version?: string | null;
  algorithm_updated_at?: string | null;
  pool_size?: number | null;
  selected_index?: number | null;
  random_value?: string | null;
  participants_hash?: string | null;
  commit_hash?: string | null;
  admin_user_id?: string | null;
  admin_user_email?: string | null;
  audit_created_at?: string | null;
}

interface DrawAuditSummary {
  drawId: string;
  poolSize: number;
  selectedIndex: number;
  randomValue: string;
  commitHash: string;
  adminUserEmail: string;
}

const SERVER_DRAW_ALGORITHM_VERSION = 'server-rejection-sampling-256-v1';
const DRAW_ALGORITHM_LANGUAGE = 'Python 3 / FastAPI';
const DRAW_ALGORITHM_UPDATED_AT = '30/04/2026 às 09:18';
const DRAW_ALGORITHM_VERSION = SERVER_DRAW_ALGORITHM_VERSION;
const API_BASE_URL =
  import.meta.env.VITE_SYNC_API_URL || 'https://api-citel-rezende-2.onrender.com';
const DRAW_ALGORITHM_SOURCE = `participantes = consulta_unica_validations_ordenada_por_validated_at_e_id
participantes_canonicos = participantes.map(({ id, code, cpf, document, validated_at }) => ({
  id, code, cpf, document, validated_at
}))

hashDosParticipantes = sha256(JSON.stringify(participantes_canonicos))
totalDeCuponsValidados = participantes.length

espacoAleatorio = 1n << 256n
limiteAceito = espacoAleatorio - (espacoAleatorio % BigInt(totalDeCuponsValidados))

repita:
  numeroAleatorioBruto = secrets.randbits(256)
ate BigInt(numeroAleatorioBruto) < limiteAceito

indiceSorteado = Number(BigInt(numeroAleatorioBruto) % BigInt(totalDeCuponsValidados))

cupomSorteado = participantes[indiceSorteado]

salvar_resultado_publico_em_draws(cupomSorteado)
salvar_auditoria_restrita_em_draw_audits(hashDosParticipantes, participantes_canonicos)`;
const LOCAL_DRAW_HISTORY_KEY = 'selecao-herois-local-draw-history';
const LOCAL_PRIZE_ITEMS_KEY = 'selecao-herois-prize-items';

const isMissingDrawTableError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' ||
  String(error.message || '').toLowerCase().includes('public.draws') ||
  String(error.message || '').toLowerCase().includes('schema cache');

const downloadWorkbook = (
  fileName: string,
  sheets: Array<{
    name: string;
    header: string[];
    rows: Array<Array<string | number>>;
  }>
) => {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.header, ...sheet.rows]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  XLSX.writeFile(workbook, fileName);
};

const loadPrizeItems = () => {
  try {
    const saved = window.localStorage.getItem(LOCAL_PRIZE_ITEMS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string' && item.trim())
      : [];
  } catch {
    return [];
  }
};

export default function CouponList({ onBack }: CouponListProps) {
  const [data, setData] = useState<Validation[]>([]);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);
  const [selectedWinner, setSelectedWinner] = useState<Validation | null>(null);
  const [selectedDrawAudit, setSelectedDrawAudit] =
    useState<DrawAuditSummary | null>(null);
  const [selectedPrizeItem, setSelectedPrizeItem] = useState('');
  const [prizeItem, setPrizeItem] = useState('');
  const [newPrizeItem, setNewPrizeItem] = useState('');
  const [prizeItems, setPrizeItems] = useState<string[]>(() => loadPrizeItems());
  const [drawMessage, setDrawMessage] = useState('');
  const [listMessage, setListMessage] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const refreshInterval = window.setInterval(fetchData, 3000);
    const handleWindowFocus = () => fetchData();
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    const channel = supabase
      .channel('admin-validations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'validations' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coupons' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draws' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      LOCAL_PRIZE_ITEMS_KEY,
      JSON.stringify(prizeItems)
    );
  }, [prizeItems]);

  const handleAddPrizeItem = () => {
    const cleanPrizeItem = newPrizeItem.trim();

    if (!cleanPrizeItem) {
      setDrawMessage('Digite o item/prêmio antes de adicionar.');
      return;
    }

    setPrizeItems((current) => {
      const alreadyExists = current.some(
        (item) => item.toLowerCase() === cleanPrizeItem.toLowerCase()
      );

      return alreadyExists ? current : [...current, cleanPrizeItem];
    });
    setPrizeItem(cleanPrizeItem);
    setNewPrizeItem('');
    setDrawMessage('');
  };

  const handleRemovePrizeItem = (itemToRemove: string) => {
    setPrizeItems((current) => current.filter((item) => item !== itemToRemove));

    if (prizeItem === itemToRemove) {
      setPrizeItem('');
    }
  };

  const fetchData = async () => {
    setListMessage('');

    const { data: validations, error } = await supabase
      .from('validations')
      .select('*')
      .order('validated_at', { ascending: false });

    if (error) {
      console.warn('Nao foi possivel buscar validacoes:', error);
      setListMessage(`Erro ao atualizar a lista: ${error.message}`);
      setLoading(false);
      return;
    }

    const validationRows = validations || [];
    const codes = validationRows.map((item) => item.code).filter(Boolean);

    const { data: coupons, error: couponError } =
      codes.length > 0
        ? await supabase
            .from('coupons')
            .select(
              'code, document_number, document_type, customer_code, customer_name, seller_code, seller_name'
            )
            .in('code', codes)
        : { data: [], error: null };

    if (couponError) {
      console.warn('Nao foi possivel enriquecer validacoes com cupons:', couponError);
      setListMessage(
        'Lista atualizada, mas não foi possível carregar os dados completos dos cupons.'
      );
    }

    const couponMap = new Map(
      (coupons || []).map((coupon) => [
        `${String(coupon.code ?? '')}:${String(coupon.document_number ?? '')}`,
        coupon,
      ])
    );

    const shouldRequireCouponMatch = !couponError && codes.length > 0;
    const enrichedValidations = validationRows.flatMap((item) => {
      const coupon = couponMap.get(
        `${String(item.code ?? '')}:${String(item.document ?? '')}`
      );

      if (shouldRequireCouponMatch && !coupon) {
        return [];
      }

      return [{
        ...item,
        customer_code: coupon?.customer_code ?? null,
        customer_name: coupon?.customer_name ?? null,
        seller_code: coupon?.seller_code ?? null,
        seller_name: coupon?.seller_name ?? null,
        document_type: coupon?.document_type ?? null,
      }];
    });

    setData(enrichedValidations);
    setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR'));
    await fetchDrawHistory(enrichedValidations);

    setLoading(false);
  };

  const fetchDrawHistory = async (validations: Validation[]) => {
    const { data: draws, error } = await supabase
      .from('draws')
      .select('*')
      .order('drawn_at', { ascending: false });

    if (error || !draws) {
      if (error) {
        console.warn('Nao foi possivel buscar historico de sorteios:', error);
        setListMessage(
          isMissingDrawTableError(error)
            ? 'A janela de sorteios ainda não foi criada no Supabase. Os sorteios aparecem temporariamente nesta máquina. Para salvar definitivo, execute o SQL create_draws_table.sql no Supabase.'
            : `Erro ao buscar sorteios salvos: ${error.message}`
        );
      }
      loadLocalDrawHistory(validations);
      return;
    }

    const { data: audits, error: auditError } = await supabase
      .from('draw_audits')
      .select(
        'draw_id, algorithm_version, algorithm_updated_at, commit_hash, pool_size, selected_index, random_value, participants_hash, admin_user_id, admin_user_email, created_at'
      );

    if (auditError) {
      console.warn('Nao foi possivel buscar auditoria dos sorteios:', auditError);
    }

    const auditMap = new Map(
      (audits || []).map((audit) => [String(audit.draw_id), audit])
    );

    const validationMap = new Map(
      validations.map((item) => [`${item.code}:${item.document}:${item.cpf}`, item])
    );

    setDrawHistory(
      draws.map((draw) => {
        const validation = validationMap.get(
          `${draw.code}:${draw.document}:${draw.cpf}`
        );
        const audit = auditMap.get(String(draw.id));

        return {
          ...(validation || {
            id: draw.validation_id || draw.id,
            code: draw.code,
            cpf: draw.cpf,
            document: draw.document,
            validated_at: draw.validated_at,
            customer_code: draw.customer_code,
            customer_name: draw.customer_name,
            seller_code: draw.seller_code,
            seller_name: draw.seller_name,
            document_type: draw.document_type,
          }),
          draw_id: draw.id,
          validation_id: draw.validation_id,
          drawn_at: draw.drawn_at,
          prize_item: draw.prize_item,
          algorithm_version: draw.algorithm_version ?? audit?.algorithm_version,
          algorithm_updated_at: audit?.algorithm_updated_at,
          pool_size: draw.pool_size ?? audit?.pool_size,
          selected_index: draw.selected_index ?? audit?.selected_index,
          random_value: draw.random_value ?? audit?.random_value,
          participants_hash: draw.participants_hash ?? audit?.participants_hash,
          commit_hash: audit?.commit_hash,
          admin_user_id: audit?.admin_user_id,
          admin_user_email: audit?.admin_user_email,
          audit_created_at: audit?.created_at,
        };
      })
    );
  };

  const enrichDrawRows = (draws: any[], validations: Validation[]) => {
    const validationMap = new Map(
      validations.map((item) => [`${item.code}:${item.document}:${item.cpf}`, item])
    );

    return draws.map((draw) => {
      const validation = validationMap.get(
        `${draw.code}:${draw.document}:${draw.cpf}`
      );

      return {
        ...(validation || {
          id: draw.validation_id || draw.id,
          code: draw.code,
          cpf: draw.cpf,
          document: draw.document,
          validated_at: draw.validated_at,
          customer_code: draw.customer_code,
          customer_name: draw.customer_name,
          seller_code: draw.seller_code,
          seller_name: draw.seller_name,
        document_type: draw.document_type,
      }),
      draw_id: draw.id,
      validation_id: draw.validation_id,
      drawn_at: draw.drawn_at,
      prize_item: draw.prize_item,
      algorithm_version: draw.algorithm_version,
      algorithm_updated_at: draw.algorithm_updated_at,
      pool_size: draw.pool_size,
      selected_index: draw.selected_index,
      random_value: draw.random_value,
      participants_hash: draw.participants_hash,
      commit_hash: draw.commit_hash,
      admin_user_id: draw.admin_user_id,
      admin_user_email: draw.admin_user_email,
      audit_created_at: draw.audit_created_at,
    };
  });
  };

  const loadLocalDrawHistory = (validations: Validation[]) => {
    try {
      const saved = window.localStorage.getItem(LOCAL_DRAW_HISTORY_KEY);
      const localDraws = saved ? JSON.parse(saved) : [];
      setDrawHistory(enrichDrawRows(localDraws, validations));
    } catch {
      setDrawHistory([]);
    }
  };

  const handleDraw = async () => {
    setDrawMessage('');

    if (data.length === 0) {
      setDrawMessage('Ainda não existem cupons validados para sortear.');
      return;
    }

    const cleanPrizeItem = prizeItem.trim();

    if (!cleanPrizeItem) {
      setDrawMessage('Informe o item/prêmio que será sorteado antes de continuar.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDrawMessage('Sessão administrativa expirada. Faça login novamente.');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/draw`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prize_item: cleanPrizeItem }),
    });

    const drawResult = await response.json();

    if (!response.ok || !drawResult.success) {
      setDrawMessage(
        drawResult.detail ||
          drawResult.message ||
          'Não foi possível realizar o sorteio no servidor.'
      );
      return;
    }

    const winner = drawResult.winner as Validation;
    const savedDraw = drawResult.draw;
    setSelectedWinner(winner);
    setSelectedPrizeItem(cleanPrizeItem);
    const rawCommitHash = String(drawResult.commit_hash || '');
    const commitHash = rawCommitHash.slice(0, 7);
    const poolSize = Number(savedDraw?.pool_size ?? data.length);
    const selectedIndex = Number(savedDraw?.selected_index ?? 0);
    const randomValue = String(savedDraw?.random_value ?? '');
    setSelectedDrawAudit({
      drawId: String(savedDraw?.id ?? ''),
      poolSize,
      selectedIndex,
      randomValue,
      commitHash: rawCommitHash,
      adminUserEmail: String(
        drawResult.admin_user_email || sessionData.session?.user?.email || ''
      ),
    });
    setDrawMessage(
      `Sorteio salvo com auditoria no servidor. Algoritmo atualizado em ${DRAW_ALGORITHM_UPDATED_AT}. Commit do backend: ${commitHash || 'não informado'}. Hash dos participantes: ${drawResult.participants_hash}`
    );
    setDrawHistory((current) => [
      {
        ...winner,
        draw_id: savedDraw?.id ?? `${winner.id}-${Date.now()}`,
        validation_id: savedDraw?.validation_id ?? winner.id,
        drawn_at: savedDraw?.drawn_at ?? new Date().toISOString(),
        prize_item: savedDraw?.prize_item ?? cleanPrizeItem,
        algorithm_version:
          savedDraw?.algorithm_version ?? SERVER_DRAW_ALGORITHM_VERSION,
        algorithm_updated_at: drawResult.algorithm_updated_at ?? null,
        pool_size: poolSize,
        selected_index: selectedIndex,
        random_value: randomValue,
        participants_hash:
          savedDraw?.participants_hash ?? drawResult.participants_hash ?? null,
        commit_hash: rawCommitHash,
        admin_user_id: drawResult.admin_user_id ?? null,
        admin_user_email:
          drawResult.admin_user_email || sessionData.session?.user?.email || null,
        audit_created_at: drawResult.audit?.created_at ?? null,
      },
      ...current,
    ]);
  };

  const buildValidationExport = () => {
    const header = [
      'Cupom',
      'CPF',
      'Cliente',
      'Nome',
      'Documento',
      'Tipo',
      'Vendedor',
      'Data de validação',
    ];

    const rows = data.map((item) => [
      item.code || '',
      formatCPF(item.cpf || ''),
      item.customer_code || '',
      item.customer_name || '',
      item.document || '',
      item.document_type || '',
      [item.seller_code, item.seller_name].filter(Boolean).join(' - '),
      item.validated_at
        ? new Date(item.validated_at).toLocaleString('pt-BR')
        : '',
    ]);

    return { header, rows };
  };

  const buildDrawExport = () => {
    const header = [
      'ID do sorteio',
      'ID da validação',
      'Sorteado em',
      'Auditoria gravada em',
      'Item sorteado',
      'Cupom',
      'CPF',
      'Cliente',
      'Nome',
      'Documento',
      'Tipo',
      'Vendedor',
      'Algoritmo',
      'Algoritmo atualizado em',
      'Total de participantes',
      'Índice técnico (0-based)',
      'Posição na lista (1-based)',
      'Número aleatório bruto',
      'Hash dos participantes',
      'Commit do backend',
      'Usuário executor ID',
      'Usuário executor e-mail',
    ];

    const rows = drawHistory.map((item) => [
      item.draw_id || '',
      item.validation_id || item.id || '',
      item.drawn_at ? new Date(item.drawn_at).toLocaleString('pt-BR') : '',
      item.audit_created_at
        ? new Date(item.audit_created_at).toLocaleString('pt-BR')
        : '',
      item.prize_item || '',
      item.code || '',
      formatCPF(item.cpf || ''),
      item.customer_code || '',
      item.customer_name || '',
      item.document || '',
      item.document_type || '',
      [item.seller_code, item.seller_name].filter(Boolean).join(' - '),
      item.algorithm_version || DRAW_ALGORITHM_VERSION,
      item.algorithm_updated_at || DRAW_ALGORITHM_UPDATED_AT,
      typeof item.pool_size === 'number' ? String(item.pool_size) : '',
      typeof item.selected_index === 'number' ? String(item.selected_index) : '',
      typeof item.selected_index === 'number' ? String(item.selected_index + 1) : '',
      item.random_value || '',
      item.participants_hash || '',
      item.commit_hash || '',
      item.admin_user_id || '',
      item.admin_user_email || '',
    ]);

    return { header, rows };
  };

  const exportToExcel = () => {
    const validations = buildValidationExport();
    downloadWorkbook('validacoes_rezende.xlsx', [
      { name: 'Validações', header: validations.header, rows: validations.rows },
    ]);
  };

  const exportDrawsToExcel = () => {
    const draws = buildDrawExport();
    downloadWorkbook('sorteados_rezende.xlsx', [
      { name: 'Sorteados', header: draws.header, rows: draws.rows },
    ]);
  };

  const exportAllToExcel = () => {
    const validations = buildValidationExport();
    const draws = buildDrawExport();
    downloadWorkbook('auditoria_promocao_rezende.xlsx', [
      { name: 'Validações', header: validations.header, rows: validations.rows },
      { name: 'Sorteados', header: draws.header, rows: draws.rows },
    ]);
  };

  return (
    <div className="coupon-list-container">
      <div className="list-header">
        <button className="btn btn-secondary btn-back" onClick={onBack}>
          LOGOFF
        </button>

        <div>
          <h2>Lista de Validações</h2>
          <p>{data.length} cupom(ns) autenticado(s)</p>
          {lastUpdatedAt && <p>Atualizado às {lastUpdatedAt}</p>}
        </div>

        <div className="list-actions">
          <button className="btn btn-secondary btn-export" onClick={fetchData}>
            Atualizar agora
          </button>

          <button className="btn btn-primary btn-export" onClick={exportToExcel}>
            Exportar validados
          </button>

          <button
            className="btn btn-primary btn-export"
            onClick={exportDrawsToExcel}
            disabled={drawHistory.length === 0}
          >
            Exportar sorteados
          </button>

          <button
            className="btn btn-primary btn-export"
            onClick={exportAllToExcel}
          >
            Exportar tudo Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Carregando validações...</p>
        </div>
      ) : (
        <>
          <section className="draw-panel">
            <div>
              <span className="draw-kicker">Sorteio</span>
              <h3>Sortear um cupom validado</h3>
              <p>
                O sorteio usa somente os cupons autenticados na tabela de
                validações.
              </p>
            </div>

            <div className="draw-prize-field">
              <span>Item/prêmio do sorteio</span>
              <div className="draw-prize-add-row">
                <input
                  value={newPrizeItem}
                  onChange={(event) => {
                    setNewPrizeItem(event.target.value);
                    setDrawMessage('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddPrizeItem();
                    }
                  }}
                  placeholder="Digite um item para adicionar"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-prize-add"
                  onClick={handleAddPrizeItem}
                >
                  Adicionar
                </button>
              </div>

              <div className="draw-prize-options">
                {prizeItems.length === 0 ? (
                  <p>Nenhum item cadastrado ainda.</p>
                ) : (
                  prizeItems.map((item) => (
                    <label
                      key={item}
                      className={`draw-prize-option ${
                        prizeItem === item ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="prize-item"
                        checked={prizeItem === item}
                        onChange={() => {
                          setPrizeItem(item);
                          setDrawMessage('');
                        }}
                      />
                      <strong>{item}</strong>
                      <button
                        type="button"
                        aria-label={`Remover ${item}`}
                        onClick={(event) => {
                          event.preventDefault();
                          handleRemovePrizeItem(item);
                        }}
                      >
                        Remover
                      </button>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button className="btn btn-primary btn-draw" onClick={handleDraw}>
              Realizar sorteio
            </button>

            <button
              className="btn btn-secondary btn-algorithm"
              onClick={() => setShowAlgorithm((current) => !current)}
            >
              {showAlgorithm ? 'Ocultar algoritmo' : 'Ver algoritmo do sorteio'}
            </button>
          </section>

          {showAlgorithm && (
            <section className="algorithm-card">
              <span className="draw-kicker">Auditoria</span>
              <h3>Algoritmo oficial do sorteio</h3>
              <ol>
                <li>
                  O sorteio é executado no backend da API, fora do navegador do
                  administrador, usando somente cupons autenticados na tabela
                  <strong> validations</strong>.
                </li>
                <li>
                  A lista de participantes é obtida em uma única consulta e
                  congelada em memória durante a execução do sorteio. Ela é
                  ordenada de forma determinística por data de validação e
                  identificador interno, antes da escolha do vencedor.
                </li>
                <li>
                  Antes do sorteio, o servidor calcula um hash SHA-256 da lista
                  canônica de participantes. A forma canônica usa somente campos
                  fixos: id, cupom, CPF, documento e data de validação. Esse hash
                  é gravado junto com o resultado para auditoria posterior.
                </li>
                <li>
                  O servidor gera um número aleatório bruto de 256 bits com
                  <strong> secrets.randbits</strong> e usa amostragem por rejeição
                  para evitar viés estatístico. O índice vencedor nasce desse
                  mesmo número bruto, então o valor salvo na auditoria fica
                  vinculado matematicamente ao resultado.
                </li>
                <li>
                  O sistema salva o resultado público na tabela <strong>draws</strong>
                  e salva a trilha completa na tabela restrita
                  <strong> draw_audits</strong>, incluindo número aleatório bruto,
                  índice sorteado, hash da lista, participantes, usuário
                  administrador, versão e data da última alteração do algoritmo.
                </li>
              </ol>
              <p>
                Versão atual do algoritmo: <strong>{DRAW_ALGORITHM_VERSION}</strong>
              </p>
              <p>
                Linguagem/ambiente do código:{' '}
                <strong>{DRAW_ALGORITHM_LANGUAGE}</strong>
              </p>
              <p>
                Última alteração do algoritmo:{' '}
                <strong>{DRAW_ALGORITHM_UPDATED_AT}</strong>
              </p>
              <p>
                Commit do backend:{' '}
                <strong>gravado automaticamente em cada sorteio</strong>
              </p>
              <p>
                Validador público:{' '}
                <a href="/?verificador=1" target="_blank" rel="noreferrer">
                  abrir verificador de sorteio
                </a>
              </p>
              <pre className="algorithm-source">
                <code>{DRAW_ALGORITHM_SOURCE}</code>
              </pre>
            </section>
          )}

          {selectedWinner && (
            <section className="winner-card">
              <span className="draw-kicker">Ganhador sorteado</span>
              <h3>{selectedWinner.customer_name || 'Cliente sem nome'}</h3>
              <p className="winner-prize">
                Item sorteado: <strong>{selectedPrizeItem}</strong>
              </p>
              <div className="winner-grid">
                <p>
                  <strong>Cupom</strong>
                  {selectedWinner.code}
                </p>
                <p>
                  <strong>CPF</strong>
                  {formatCPF(selectedWinner.cpf)}
                </p>
                <p>
                  <strong>Documento</strong>
                  {[selectedWinner.document, selectedWinner.document_type]
                    .filter(Boolean)
                    .join('-') || '-'}
                </p>
                <p>
                  <strong>Vendedor</strong>
                  {[selectedWinner.seller_code, selectedWinner.seller_name]
                    .filter(Boolean)
                    .join(' - ') || '-'}
                </p>
              </div>
              {selectedDrawAudit && (
                <div className="winner-audit-grid">
                  <p>
                    <strong>ID do sorteio</strong>
                    {selectedDrawAudit.drawId || '-'}
                  </p>
                  <p>
                    <strong>Total de participantes</strong>
                    {selectedDrawAudit.poolSize}
                  </p>
                  <p>
                    <strong>Índice técnico (0-based)</strong>
                    {selectedDrawAudit.selectedIndex}
                  </p>
                  <p>
                    <strong>Posição na lista (1-based)</strong>
                    {selectedDrawAudit.selectedIndex + 1} de{' '}
                    {selectedDrawAudit.poolSize}
                  </p>
                  <p>
                    <strong>Número aleatório bruto</strong>
                    {selectedDrawAudit.randomValue || '-'}
                  </p>
                  <p>
                    <strong>Executado por</strong>
                    {selectedDrawAudit.adminUserEmail || '-'}
                  </p>
                  <p>
                    <strong>Commit do backend</strong>
                    {selectedDrawAudit.commitHash || '-'}
                  </p>
                </div>
              )}
              {drawMessage && <p className="draw-message">{drawMessage}</p>}
            </section>
          )}

          {drawMessage && !selectedWinner && (
            <p className="draw-message">{drawMessage}</p>
          )}

          <section className="draw-history">
            <h3>Janela de sorteios salvos</h3>
            {drawHistory.length === 0 ? (
              <div className="empty-section empty-section--compact">
                <h3>Nenhum sorteio salvo ainda</h3>
                <p>
                  Quando você realizar um sorteio com item informado, o resultado
                  ficará guardado aqui.
                </p>
              </div>
            ) : (
              <div className="validation-table-wrap">
                <table className="validation-table">
                  <thead>
                    <tr>
                      <th>Sorteado em</th>
                      <th>Item</th>
                      <th>Cupom</th>
                      <th>CPF</th>
                      <th>Nome</th>
                      <th>Documento</th>
                      <th>Auditoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drawHistory.map((item) => (
                      <tr key={item.draw_id}>
                        <td>
                          {item.drawn_at
                            ? new Date(item.drawn_at).toLocaleString('pt-BR')
                            : '-'}
                        </td>
                        <td>{item.prize_item || '-'}</td>
                        <td>{item.code}</td>
                        <td>{item.cpf ? formatCPF(item.cpf) : '-'}</td>
                        <td>{item.customer_name || '-'}</td>
                        <td>
                          {[item.document, item.document_type]
                            .filter(Boolean)
                            .join('-') || '-'}
                        </td>
                        <td>
                          {item.algorithm_version || DRAW_ALGORITHM_VERSION}
                          {typeof item.pool_size === 'number' &&
                            typeof item.selected_index === 'number' &&
                            ` | ${item.selected_index + 1}/${item.pool_size}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {listMessage && <p className="draw-message">{listMessage}</p>}

          <div className="validation-table-wrap">
            <table className="validation-table">
              <thead>
                <tr>
                  <th>Cupom</th>
                  <th>CPF</th>
                  <th>Cliente</th>
                  <th>Nome</th>
                  <th>Documento</th>
                  <th>Vendedor</th>
                  <th>Data</th>
                </tr>
              </thead>

              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.cpf ? formatCPF(item.cpf) : '-'}</td>
                    <td>{item.customer_code || '-'}</td>
                    <td>{item.customer_name || '-'}</td>
                    <td>
                      {[item.document, item.document_type]
                        .filter(Boolean)
                        .join('-') || '-'}
                    </td>
                    <td>
                      {[item.seller_code, item.seller_name]
                        .filter(Boolean)
                        .join(' - ') || '-'}
                    </td>
                    <td>
                      {item.validated_at
                        ? new Date(item.validated_at).toLocaleString('pt-BR')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

