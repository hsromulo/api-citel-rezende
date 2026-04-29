import { useEffect, useState } from 'react';
import { formatCPF, supabase } from '../services/supabaseService';
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
  drawn_at: string;
  prize_item?: string | null;
  algorithm_version?: string | null;
  pool_size?: number | null;
  selected_index?: number | null;
}

const DRAW_ALGORITHM_VERSION = 'crypto-random-v1';
const DRAW_ALGORITHM_SOURCE = `const participantes = validacoesAutenticadas;
const totalDeCuponsValidados = participantes.length;
const randomValues = new Uint32Array(1);

window.crypto.getRandomValues(randomValues);

const numeroAleatorio = randomValues[0];
const posicaoVencedora = numeroAleatorio % totalDeCuponsValidados;
const cupomSorteado = participantes[posicaoVencedora];`;
const LOCAL_DRAW_HISTORY_KEY = 'selecao-herois-local-draw-history';

const isMissingDrawTableError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' ||
  String(error.message || '').toLowerCase().includes('public.draws') ||
  String(error.message || '').toLowerCase().includes('schema cache');

export default function CouponList({ onBack }: CouponListProps) {
  const [data, setData] = useState<Validation[]>([]);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);
  const [selectedWinner, setSelectedWinner] = useState<Validation | null>(null);
  const [selectedPrizeItem, setSelectedPrizeItem] = useState('');
  const [prizeItem, setPrizeItem] = useState('');
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

    const validationMap = new Map(
      validations.map((item) => [`${item.code}:${item.document}:${item.cpf}`, item])
    );

    setDrawHistory(
      draws.map((draw) => {
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
          drawn_at: draw.drawn_at,
          prize_item: draw.prize_item,
          algorithm_version: draw.algorithm_version,
          pool_size: draw.pool_size,
          selected_index: draw.selected_index,
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
        drawn_at: draw.drawn_at,
        prize_item: draw.prize_item,
        algorithm_version: draw.algorithm_version,
        pool_size: draw.pool_size,
        selected_index: draw.selected_index,
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

  const saveLocalDraw = (draw: any, winner: Validation) => {
    const localDraw = {
      ...draw,
      id: `local-${Date.now()}`,
      drawn_at: new Date().toISOString(),
    };

    const saved = window.localStorage.getItem(LOCAL_DRAW_HISTORY_KEY);
    const current = saved ? JSON.parse(saved) : [];
    const next = [localDraw, ...current];
    window.localStorage.setItem(LOCAL_DRAW_HISTORY_KEY, JSON.stringify(next));

    setDrawHistory((history) => [
      {
        ...winner,
        draw_id: localDraw.id,
        drawn_at: localDraw.drawn_at,
        prize_item: localDraw.prize_item,
        algorithm_version: localDraw.algorithm_version,
        pool_size: localDraw.pool_size,
        selected_index: localDraw.selected_index,
      },
      ...history,
    ]);
  };

  const chooseRandomValidation = () => {
    const randomValues = new Uint32Array(1);
    window.crypto.getRandomValues(randomValues);
    const selectedIndex = randomValues[0] % data.length;

    return {
      winner: data[selectedIndex],
      randomValue: randomValues[0],
      selectedIndex,
    };
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

    const { winner, randomValue, selectedIndex } = chooseRandomValidation();
    setSelectedWinner(winner);
    setSelectedPrizeItem(cleanPrizeItem);

    const drawPayload = {
      validation_id: winner.id,
      prize_item: cleanPrizeItem,
      code: winner.code,
      cpf: winner.cpf,
      document: winner.document,
      document_type: winner.document_type,
      customer_code: winner.customer_code,
      customer_name: winner.customer_name,
      seller_code: winner.seller_code,
      seller_name: winner.seller_name,
      validated_at: winner.validated_at,
      algorithm_version: DRAW_ALGORITHM_VERSION,
      pool_size: data.length,
      random_value: String(randomValue),
      selected_index: selectedIndex,
    };

    const { data: savedDraw, error } = await supabase
      .from('draws')
      .insert([drawPayload])
      .select()
      .single();

    if (error) {
      console.warn('Nao foi possivel salvar sorteio:', error);
      saveLocalDraw(drawPayload, winner);
      setDrawMessage(
        isMissingDrawTableError(error)
          ? 'Sorteio exibido na janela local desta máquina. Para salvar definitivo no Supabase, execute o SQL create_draws_table.sql.'
          : `Sorteio exibido na janela local, mas o Supabase retornou erro: ${error.message}`
      );
      return;
    }

    setDrawMessage('Sorteio salvo no histórico com sucesso.');
    setDrawHistory((current) => [
      {
        ...winner,
        draw_id: savedDraw?.id ?? `${winner.id}-${Date.now()}`,
        drawn_at: savedDraw?.drawn_at ?? new Date().toISOString(),
        prize_item: savedDraw?.prize_item ?? cleanPrizeItem,
        algorithm_version: savedDraw?.algorithm_version ?? DRAW_ALGORITHM_VERSION,
        pool_size: savedDraw?.pool_size ?? data.length,
        selected_index: savedDraw?.selected_index ?? selectedIndex,
      },
      ...current,
    ]);
  };

  const exportToExcel = () => {
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

    const escapeCsvCell = (value: string) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      'sep=;',
      header.map(escapeCsvCell).join(';'),
      ...rows.map((row) => row.map(escapeCsvCell).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'validacoes_rezende.csv';
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportDrawsToExcel = () => {
    const header = [
      'Sorteado em',
      'Item sorteado',
      'Cupom',
      'CPF',
      'Cliente',
      'Nome',
      'Documento',
      'Tipo',
      'Vendedor',
      'Algoritmo',
      'Posição sorteada',
      'Total de cupons',
    ];

    const rows = drawHistory.map((item) => [
      item.drawn_at ? new Date(item.drawn_at).toLocaleString('pt-BR') : '',
      item.prize_item || '',
      item.code || '',
      formatCPF(item.cpf || ''),
      item.customer_code || '',
      item.customer_name || '',
      item.document || '',
      item.document_type || '',
      [item.seller_code, item.seller_name].filter(Boolean).join(' - '),
      item.algorithm_version || DRAW_ALGORITHM_VERSION,
      typeof item.selected_index === 'number' ? String(item.selected_index + 1) : '',
      typeof item.pool_size === 'number' ? String(item.pool_size) : '',
    ]);

    const escapeCsvCell = (value: string) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      'sep=;',
      header.map(escapeCsvCell).join(';'),
      ...rows.map((row) => row.map(escapeCsvCell).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'sorteados_rezende.csv';
    link.click();

    URL.revokeObjectURL(url);
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

            <label className="draw-prize-field">
              <span>Item/prêmio do sorteio</span>
              <input
                value={prizeItem}
                onChange={(event) => {
                  setPrizeItem(event.target.value);
                  setDrawMessage('');
                }}
                placeholder="Ex.: Vale-compras, TV, kit de ferramentas..."
              />
            </label>

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
              <h3>Algoritmo do sorteio</h3>
              <ol>
                <li>
                  O sistema carrega todos os cupons autenticados da tabela
                  <strong> validations</strong>.
                </li>
                <li>
                  Cada cupom validado vira uma chance no sorteio. As chances
                  são iguais para todos os cupons: 1 cupom validado = 1 chance.
                </li>
                <li>
                  No clique em <strong>Realizar sorteio</strong>, o navegador
                  gera um número aleatório criptográfico com
                  <strong> window.crypto.getRandomValues</strong>.
                </li>
                <li>
                  A posição vencedora é calculada por:
                  <code>numeroAleatorio % totalDeCuponsValidados</code>.
                </li>
                <li>
                  O resultado é salvo na tabela <strong>draws</strong> com a
                  versão do algoritmo, total de participantes e posição
                  sorteada.
                </li>
              </ol>
              <p>
                Versão atual do algoritmo: <strong>{DRAW_ALGORITHM_VERSION}</strong>
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

