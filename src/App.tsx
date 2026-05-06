import { useEffect, useMemo, useState } from 'react';
import './App.css';
import ValidationResult from './components/ValidationResult';
import AuthForm from './components/AuthForm';
import CustomerCouponList from './components/CustomerCouponList';
import CouponList from './components/CouponList';
import DrawValidator from './components/DrawValidator';
import Login from './components/Login';
import {
  getCurrentUser,
  CustomerCoupon,
  getCouponsByCpf,
  signIn,
  signOut,
  validateCoupon,
} from './services/supabaseService';

type ValidationStatus =
  | 'idle'
  | 'loading-coupons'
  | 'customer-coupons'
  | 'validating'
  | 'error';

interface CouponData {
  id: string;
  code: string;
  cpf: string;
  documentNumber: string;
  isValid: boolean;
  message: string;
  title?: string;
}

interface FeedbackModalState {
  title: string;
  message: string;
  tone: 'success' | 'warning';
  actionLabel: string;
  actionMode?: 'dismiss' | 'validate-remaining';
}

const CUSTOMER_SESSION_KEY = 'selecao-herois-customer-session';
const CPF_LOOKUP_TIMEOUT_MS = 15000;

type CustomerSession = {
  cpf: string;
  customerName?: string;
  emptyMessage?: string;
  coupons: CustomerCoupon[];
};

const loadCustomerSession = (): CustomerSession | null => {
  try {
    const savedSession = window.localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!savedSession) return null;

    const parsedSession = JSON.parse(savedSession) as CustomerSession;

    if (!parsedSession.cpf || !Array.isArray(parsedSession.coupons)) {
      return null;
    }

    return parsedSession;
  } catch {
    return null;
  }
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);

function App() {
  const [adminMode, setAdminMode] = useState(() =>
    window.location.search.includes('admin=1')
  );
  const [validatorMode] = useState(() =>
    window.location.search.includes('verificador=1')
  );
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const savedSession = useMemo(() => loadCustomerSession(), []);
  const [status, setStatus] = useState<ValidationStatus>(
    savedSession ? 'customer-coupons' : 'idle'
  );
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [customerCpf, setCustomerCpf] = useState(savedSession?.cpf ?? '');
  const [customerName, setCustomerName] = useState(savedSession?.customerName ?? '');
  const [emptyCouponMessage, setEmptyCouponMessage] = useState(
    savedSession?.emptyMessage ?? ''
  );
  const [customerCoupons, setCustomerCoupons] = useState<CustomerCoupon[]>(
    savedSession?.coupons ?? []
  );
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState | null>(
    null
  );
  const [showDrawnCouponModal, setShowDrawnCouponModal] = useState(false);
  const [shownDrawnCouponKey, setShownDrawnCouponKey] = useState('');
  const [forceSelectAllSignal, setForceSelectAllSignal] = useState(0);

  useEffect(() => {
    if (!adminMode) return;

    setAdminChecking(true);
    getCurrentUser()
      .then((user) => setAdminAuthenticated(Boolean(user)))
      .finally(() => setAdminChecking(false));
  }, [adminMode]);

  const availableCoupons = useMemo(
    () => customerCoupons.filter((coupon) => !coupon.isUsed),
    [customerCoupons]
  );

  const validatedCoupons = useMemo(
    () => customerCoupons.filter((coupon) => coupon.isUsed),
    [customerCoupons]
  );

  const drawnCoupons = useMemo(
    () => customerCoupons.filter((coupon) => coupon.isDrawn),
    [customerCoupons]
  );

  const drawnCouponKey = useMemo(
    () =>
      drawnCoupons
        .map((coupon) => `${coupon.code}:${coupon.prizeItem ?? ''}:${coupon.drawnAt ?? ''}`)
        .join('|'),
    [drawnCoupons]
  );

  useEffect(() => {
    if (
      status === 'customer-coupons' &&
      !showQuestionModal &&
      drawnCouponKey &&
      drawnCouponKey !== shownDrawnCouponKey
    ) {
      setShownDrawnCouponKey(drawnCouponKey);
      setShowDrawnCouponModal(true);
    }
  }, [
    drawnCouponKey,
    showQuestionModal,
    shownDrawnCouponKey,
    status,
  ]);

  useEffect(() => {
    if (
      status === 'customer-coupons' &&
      !showQuestionModal &&
      customerCpf &&
      customerCoupons.length > 0
    ) {
      window.localStorage.setItem(
        CUSTOMER_SESSION_KEY,
        JSON.stringify({
          cpf: customerCpf,
          customerName,
          emptyMessage: emptyCouponMessage,
          coupons: customerCoupons,
        })
      );
    }
  }, [
    customerCpf,
    customerCoupons,
    customerName,
    emptyCouponMessage,
    showQuestionModal,
    status,
  ]);

  const handleCpfSubmit = async (cpf: string) => {
    setStatus('loading-coupons');
    setCouponData(null);
    setFeedbackModal(null);
    setShowDrawnCouponModal(false);
    setShownDrawnCouponKey('');
    setQuestionAnswer('');
    setQuestionError('');
    setForceSelectAllSignal(0);
    setCustomerName('');
    setEmptyCouponMessage('');

    let result;

    try {
      result = await withTimeout(
        getCouponsByCpf(cpf),
        CPF_LOOKUP_TIMEOUT_MS,
        'A consulta demorou mais que o esperado. Tente novamente em alguns instantes.'
      );
    } catch (error) {
      setCouponData({
        id: '',
        code: '',
        cpf,
        documentNumber: '',
        isValid: false,
        title: 'Não foi possível consultar',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar este CPF agora.',
      });
      setStatus('error');
      return;
    }

    if (!result.success) {
      setCouponData({
        id: '',
        code: '',
        cpf,
        documentNumber: '',
        isValid: false,
        title: 'CPF não localizado',
        message:
          result.message ||
          'Não foi possível consultar este CPF. Confira os números e tente novamente.',
      });
      setStatus('error');
      return;
    }

    setCustomerCpf(cpf);
    setCustomerName(result.customerName ?? result.coupons[0]?.customerName ?? '');
    setEmptyCouponMessage(result.message ?? '');
    setCustomerCoupons(result.coupons);
    setShowQuestionModal(true);
    setStatus('customer-coupons');
  };

  const handleQuestionConfirm = async () => {
    if (!questionAnswer) {
      setQuestionError('Escolha uma resposta para continuar.');
      return;
    }

    if (questionAnswer !== 'rezende-palmeira') {
      setQuestionError(
        'Resposta incorreta. Para continuar, marque "Rezende Construção e Palmeira Tintas".'
      );
      return;
    }

    setQuestionError('');
    setShowQuestionModal(false);

    let refreshedCoupons;

    try {
      refreshedCoupons = await withTimeout(
        getCouponsByCpf(customerCpf),
        CPF_LOOKUP_TIMEOUT_MS,
        'A atualização dos cupons demorou mais que o esperado.'
      );
    } catch {
      return;
    }

    if (refreshedCoupons.success) {
      setCustomerCoupons(refreshedCoupons.coupons);
      setCustomerName(
        refreshedCoupons.customerName ??
          refreshedCoupons.coupons[0]?.customerName ??
          customerName
      );
      setEmptyCouponMessage(refreshedCoupons.message ?? emptyCouponMessage);
      const nextDrawnCouponKey = refreshedCoupons.coupons
        .filter((coupon) => coupon.isDrawn)
        .map((coupon) => `${coupon.code}:${coupon.prizeItem ?? ''}:${coupon.drawnAt ?? ''}`)
        .join('|');

      if (nextDrawnCouponKey) {
        setShownDrawnCouponKey(nextDrawnCouponKey);
      }

      setShowDrawnCouponModal(
        refreshedCoupons.coupons.some((coupon) => coupon.isDrawn)
      );
      return;
    }

    setShowDrawnCouponModal(drawnCoupons.length > 0);
  };

  const handleValidateSelectedCoupons = async (coupons: CustomerCoupon[]) => {
    setStatus('validating');

    const results = await Promise.all(
      coupons.map(async (coupon) => ({
        coupon,
        result: await validateCoupon(coupon.code, coupon.documentNumber, coupon.cpf),
      }))
    );

    const successfulCoupons = results
      .filter((item) => item.result.success)
      .map((item) => item.coupon);
    const failedCoupons = results.filter((item) => !item.result.success);

    if (successfulCoupons.length > 0) {
      setCustomerCoupons((current) =>
        current.map((item) =>
          successfulCoupons.some((coupon) => coupon.id === item.id)
            ? { ...item, isUsed: true }
            : item
        )
      );
    }

    const remainingCoupons = customerCoupons.filter(
      (item) =>
        !item.isUsed && !successfulCoupons.some((coupon) => coupon.id === item.id)
    );

    if (failedCoupons.length === 0) {
      setFeedbackModal({
        title:
          successfulCoupons.length > 1
            ? 'Cupons validados e participando do sorteio'
            : 'Cupom validado e participando do sorteio',
        message:
          remainingCoupons.length > 0
            ? `Você autenticou ${successfulCoupons.length} cupom(ns) e ainda restam ${remainingCoupons.length}. Quer validar todos os demais agora?`
            : 'Todos os cupons disponíveis deste CPF já foram autenticados.',
        tone: remainingCoupons.length > 0 ? 'warning' : 'success',
        actionLabel:
          remainingCoupons.length > 0
            ? 'Sim, quero validar todos e aumentar as minhas chances no sorteio'
            : 'Continuar',
        actionMode:
          remainingCoupons.length > 0 ? 'validate-remaining' : 'dismiss',
      });
      setStatus('customer-coupons');
      return;
    }

    if (successfulCoupons.length > 0) {
      setFeedbackModal({
        title: 'Verificação parcial concluída',
        message:
          `${successfulCoupons.length} cupom(ns) foram validados e ja estao participando do sorteio. ` +
          `${failedCoupons.length} não puderam ser autenticados. Primeiro motivo: ` +
          `${failedCoupons[0].result.message || 'erro inesperado.'} ` +
          (remainingCoupons.length > 0
            ? 'Você ainda pode validar todos os demais agora.'
            : ''),
        tone: 'warning',
        actionLabel:
          remainingCoupons.length > 0
            ? 'Sim, quero validar todos e aumentar as minhas chances no sorteio'
            : 'Entendi',
        actionMode:
          remainingCoupons.length > 0 ? 'validate-remaining' : 'dismiss',
      });
      setStatus('customer-coupons');
      return;
    }

    setCouponData({
      id: failedCoupons[0].result.id ?? '',
      code: failedCoupons[0].coupon.code,
      cpf: customerCpf,
      documentNumber: failedCoupons[0].coupon.documentNumber,
      isValid: false,
      title: 'Não foi possível autenticar',
      message:
        failedCoupons[0].result.message ||
        'Não foi possível autenticar os cupons selecionados.',
    });
    setStatus('error');
  };

  const handleBackToCoupons = () => {
    setCouponData(null);
    setStatus(customerCpf ? 'customer-coupons' : 'idle');
  };

  const handleHome = () => {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
    setStatus('idle');
    setCouponData(null);
    setCustomerCpf('');
    setCustomerName('');
    setEmptyCouponMessage('');
    setCustomerCoupons([]);
    setShowQuestionModal(false);
    setQuestionAnswer('');
    setQuestionError('');
    setFeedbackModal(null);
    setShowDrawnCouponModal(false);
    setShownDrawnCouponKey('');
    setForceSelectAllSignal(0);
  };

  const handleAdminLogin = async (email: string, password: string) => {
    const result = await signIn(email, password);

    if (!result.success) {
      return {
        success: false,
        error: result.message || 'Não foi possível entrar.',
      };
    }

    setAdminAuthenticated(true);
    return { success: true };
  };

  const handleAdminExit = async () => {
    await signOut();
    setAdminAuthenticated(false);
    setAdminMode(true);
    window.history.replaceState({}, '', `${window.location.pathname}?admin=1`);
  };

  if (validatorMode) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="header-content">
            <div className="header-campaign-logo">
              <img src="/selecao-herois-logo-oficial.svg" alt="Seleção dos Heróis" />
            </div>
            <h1>Validador de Sorteio</h1>
            <p>
              Recalcule a prova técnica de um sorteio usando hash, número
              aleatório bruto e lista canônica de participantes.
            </p>
          </div>
        </header>

        <main className="main-content">
          <DrawValidator />
        </main>
      </div>
    );
  }

  if (adminMode) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="header-content">
            <div className="header-campaign-logo">
              <img src="/selecao-herois-logo-oficial.svg" alt="Seleção dos Heróis" />
            </div>
            <h1>Validações e Sorteios</h1>
            <p>Consulte, exporte e sorteie os cupons autenticados da promoção.</p>
          </div>
        </header>

        <main className="main-content">
          {adminChecking ? (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Verificando acesso...</p>
            </div>
          ) : adminAuthenticated ? (
            <CouponList onBack={handleAdminExit} />
          ) : (
            <Login
              onLogin={handleAdminLogin}
              onCancel={() => {
                setAdminMode(false);
                window.history.replaceState({}, '', window.location.pathname);
              }}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-campaign-logo">
            <img src="/selecao-herois-logo-oficial.svg" alt="Seleção dos Heróis" />
          </div>
        </div>
      </header>

      <main className="main-content">
        {!import.meta.env.VITE_SUPABASE_URL ||
        !import.meta.env.VITE_SUPABASE_ANON_KEY ? (
          <div className="error-section">
            <h2>Configuração incompleta</h2>
            <p>As variáveis de ambiente do Supabase não foram configuradas.</p>
          </div>
        ) : (
          <>
            {status === 'idle' && <AuthForm onAuthenticate={handleCpfSubmit} />}

            {status === 'loading-coupons' && (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Buscando os cupons deste CPF...</p>
              </div>
            )}

            {status === 'customer-coupons' && !showQuestionModal && (
              <CustomerCouponList
                cpf={customerCpf}
                customerName={customerName}
                emptyMessage={emptyCouponMessage}
                coupons={customerCoupons}
                availableCoupons={availableCoupons}
                validatedCoupons={validatedCoupons}
                forceSelectAllSignal={forceSelectAllSignal}
                onBack={handleHome}
                onValidate={handleValidateSelectedCoupons}
              />
            )}

            {status === 'validating' && (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Autenticando cupons selecionados...</p>
              </div>
            )}

            {status === 'error' && couponData && (
              <ValidationResult
                couponData={couponData}
                onScanAgain={handleBackToCoupons}
                onHome={handleHome}
                primaryButtonLabel="Voltar para os cupons"
              />
            )}
          </>
        )}
      </main>

      {showQuestionModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-card--quiz">
            <div className="modal-badge">Antes de continuar</div>
            <h2>Confirme sua participação</h2>
            <p>
              Quais são as empresas que sorteiam prêmios incríveis para os
              clientes?
            </p>

            <label
              className={`modal-option ${
                questionAnswer === 'rezende-palmeira' ? 'selected' : ''
              }`}
            >
              <input
                type="radio"
                name="campaign-answer"
                value="rezende-palmeira"
                checked={questionAnswer === 'rezende-palmeira'}
                onChange={(event) => {
                  setQuestionAnswer(event.target.value);
                  setQuestionError('');
                }}
              />
              <span>Rezende Construção e Palmeira Tintas</span>
            </label>

            <label
              className={`modal-option ${
                questionAnswer === 'outros' ? 'selected' : ''
              }`}
            >
              <input
                type="radio"
                name="campaign-answer"
                value="outros"
                checked={questionAnswer === 'outros'}
                onChange={(event) => {
                  setQuestionAnswer(event.target.value);
                  setQuestionError('');
                }}
              />
              <span>Outros</span>
            </label>

            {questionError && <p className="modal-error">{questionError}</p>}

            <button className="btn btn-primary" onClick={handleQuestionConfirm}>
              Continuar para os cupons
            </button>
          </div>
        </div>
      )}

      {showDrawnCouponModal && drawnCoupons.length > 0 && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-card--drawn">
            <div className="modal-badge">Cupom sorteado</div>
            <h2>
              {drawnCoupons.length > 1
                ? 'Você possui cupons sorteados'
                : 'Você possui um cupom sorteado'}
            </h2>
            <p>
              Confira abaixo {drawnCoupons.length > 1 ? 'os prêmios' : 'o prêmio'} vinculado
              {drawnCoupons.length > 1 ? 's aos seus cupons.' : ' ao seu cupom.'}
            </p>

            <div className="drawn-coupon-modal-list">
              {drawnCoupons.map((coupon) => (
                <article key={coupon.id} className="drawn-coupon-modal-item">
                  <span>Cupom {coupon.code}</span>
                  <strong>{coupon.prizeItem || 'Item não informado'}</strong>
                  {coupon.drawnAt && (
                    <small>
                      Sorteado em {new Date(coupon.drawnAt).toLocaleString('pt-BR')}
                    </small>
                  )}
                </article>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowDrawnCouponModal(false)}
            >
              Ver meus cupons
            </button>
          </div>
        </div>
      )}

      {feedbackModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className={`modal-card modal-card--${feedbackModal.tone}`}>
            <div className="modal-badge">
              {feedbackModal.tone === 'success' ? 'Tudo certo' : 'Atenção'}
            </div>
            <h2>{feedbackModal.title}</h2>
            <p>{feedbackModal.message}</p>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (feedbackModal.actionMode === 'validate-remaining') {
                    setFeedbackModal(null);
                    handleValidateSelectedCoupons(availableCoupons);
                    return;
                  }
                  setFeedbackModal(null);
                }}
              >
                {feedbackModal.actionLabel}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setFeedbackModal(null)}
              >
                {feedbackModal.actionMode === 'validate-remaining'
                  ? 'Não, desejo validar somente este cupom'
                  : 'Continuar na minha conta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>&copy; 2026 Seleção dos Heróis. Promoção válida conforme regulamento.</p>
      </footer>
    </div>
  );
}

export default App;
