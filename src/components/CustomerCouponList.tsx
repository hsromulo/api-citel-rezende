import React, { useEffect, useMemo, useState } from 'react';
import './CustomerCouponList.css';
import { CustomerCoupon, formatCPF } from '../services/supabaseService';

type CouponWindow = 'available' | 'validated' | 'total';

interface CustomerCouponListProps {
  cpf: string;
  customerName?: string;
  emptyMessage?: string;
  coupons: CustomerCoupon[];
  availableCoupons: CustomerCoupon[];
  validatedCoupons: CustomerCoupon[];
  loading?: boolean;
  onBack: () => void;
  onValidate: (coupons: CustomerCoupon[]) => void;
  forceSelectAllSignal?: number;
}

const formatDate = (value?: string | null) => {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('pt-BR');
};

const formatTime = (value?: string | null) => {
  if (!value) return '-';

  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRawTime = (value?: string | null) => {
  if (!value) return '-';

  const time = String(value).trim();
  const compactTimeMatch = time.match(/^(\d{2})(\d{2})(\d{2})?$/);

  if (compactTimeMatch) {
    return [compactTimeMatch[1], compactTimeMatch[2]].join(':');
  }

  return time.slice(0, 5);
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const getDocumentReference = (coupon: CustomerCoupon) =>
  [coupon.documentNumber, coupon.documentType].filter(Boolean).join('-') || '-';

const getSellerLabel = (coupon: CustomerCoupon) =>
  [coupon.sellerCode, coupon.sellerName].filter(Boolean).join(' - ') || '-';

const CustomerCouponList: React.FC<CustomerCouponListProps> = ({
  cpf,
  customerName: customerNameFromLookup = '',
  emptyMessage,
  coupons,
  availableCoupons,
  validatedCoupons,
  loading = false,
  onBack,
  onValidate,
  forceSelectAllSignal = 0,
}) => {
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [activeWindow, setActiveWindow] = useState<CouponWindow | null>(null);

  const selectedCoupons = useMemo(
    () => availableCoupons.filter((coupon) => selectedCouponIds.includes(coupon.id)),
    [availableCoupons, selectedCouponIds]
  );
  const customerName =
    coupons.find((coupon) => coupon.customerName)?.customerName ||
    customerNameFromLookup;
  const hasNoCoupons = coupons.length === 0;

  useEffect(() => {
    if (forceSelectAllSignal > 0 && availableCoupons.length > 0) {
      setSelectedCouponIds(availableCoupons.map((coupon) => coupon.id));
      setActiveWindow('available');
      setFormError('');
    }
  }, [forceSelectAllSignal, availableCoupons]);

  const toggleCouponSelection = (couponId: string) => {
    setSelectedCouponIds((current) =>
      current.includes(couponId)
        ? current.filter((id) => id !== couponId)
        : [...current, couponId]
    );
    setFormError('');
  };

  const handleSelectAll = () => {
    setSelectedCouponIds(availableCoupons.map((coupon) => coupon.id));
    setFormError('');
  };

  const handleClearSelection = () => {
    setSelectedCouponIds([]);
    setFormError('');
  };

  const handleValidate = () => {
    if (selectedCoupons.length === 0) {
      setFormError('Escolha pelo menos um cupom disponível para autenticar.');
      return;
    }

    setFormError('');
    onValidate(selectedCoupons);
  };

  const toggleWindow = (window: CouponWindow) => {
    setActiveWindow((current) => (current === window ? null : window));
  };

  const renderWindowToggle = (window: CouponWindow) => (
    <span className="customer-window-toggle" aria-hidden="true">
      {activeWindow === window ? 'Recolher' : 'Expandir'}
    </span>
  );

  const renderStatusBadge = (coupon: CustomerCoupon) => (
    <span
      className={`customer-status-badge ${
        coupon.isDrawn ? 'drawn' : coupon.isUsed ? 'used' : 'available'
      }`}
    >
      {coupon.isDrawn ? 'Sorteado' : coupon.isUsed ? 'Validado' : 'Não validado'}
    </span>
  );

  const renderCouponDetails = (coupon: CustomerCoupon) => (
    <div className="customer-receipt">
      <div className="customer-receipt-title">
        <strong>Cupom promocional</strong>
        <span>Seleção dos Heróis</span>
      </div>

      <dl className="customer-receipt-details">
        <div>
          <dt>Referente ao documento</dt>
          <dd>{getDocumentReference(coupon)}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{coupon.customerCode || '-'}</dd>
        </div>
        <div className="customer-receipt-details--wide">
          <dt>Nome</dt>
          <dd>{coupon.customerName || customerName || '-'}</dd>
        </div>
        <div>
          <dt>CPF</dt>
          <dd>{formatCPF(coupon.cpf)}</dd>
        </div>
        <div>
          <dt>Vendedor</dt>
          <dd>{getSellerLabel(coupon)}</dd>
        </div>
        <div>
          <dt>Telefone</dt>
          <dd>{coupon.customerPhone || '-'}</dd>
        </div>
        <div>
          <dt>Celular</dt>
          <dd>{coupon.customerMobile || '-'}</dd>
        </div>
        <div className="customer-receipt-details--wide">
          <dt>Endereço</dt>
          <dd>
            {[coupon.customerAddress, coupon.customerNeighborhood, coupon.customerZipcode]
              .filter(Boolean)
              .join(' - ') || '-'}
          </dd>
        </div>
        <div>
          <dt>Valor do documento</dt>
          <dd>{formatCurrency(coupon.documentAmount)}</dd>
        </div>
        <div>
          <dt>Validade</dt>
          <dd>{formatDate(coupon.expiryDate)}</dd>
        </div>
        {coupon.isDrawn && (
          <div className="customer-receipt-details--wide">
            <dt>Item sorteado</dt>
            <dd>{coupon.prizeItem || 'Item não informado'}</dd>
          </div>
        )}
      </dl>

      <div className="customer-receipt-footer">
        <strong>Cupom: {coupon.code}</strong>
        <span>
          {formatDate(coupon.saleDate || coupon.createdAt)}{' '}
          {coupon.saleTime ? formatRawTime(coupon.saleTime) : formatTime(coupon.createdAt)}
        </span>
      </div>
    </div>
  );

  const renderBuyMoreMessage = (title: string) => (
    <div className="customer-empty-state customer-empty-state--soft">
      <h4>{title}</h4>
      <p>
        {emptyMessage ||
          'Compre mais produtos participantes para gerar novos cupons e aumentar suas chances no sorteio.'}
      </p>
    </div>
  );

  const renderTotalCoupon = (coupon: CustomerCoupon) => {
    const statusClass = coupon.isDrawn
      ? 'drawn'
      : coupon.isUsed
        ? 'used'
        : 'available';

    return (
      <article key={coupon.id} className={`customer-summary-row ${statusClass}`}>
      <div>
        <span className="customer-coupon-label">Cupom</span>
        <strong>{coupon.code}</strong>
        <small>{coupon.documentNumber || '-'}</small>
      </div>
      {renderStatusBadge(coupon)}
    </article>
    );
  };

  const getWindowClassName = (window: CouponWindow, extraClass: string) =>
    [
      'customer-stat-card',
      'customer-window-card',
      extraClass,
      activeWindow === window ? 'active' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="customer-coupon-list">
      <div className="customer-coupon-hero">
        <div>
          <span className="customer-coupon-kicker">Área do participante</span>
          <h2>Seus cupons da Seleção dos Heróis</h2>
          <p>
            CPF consultado: <strong>{formatCPF(cpf)}</strong>
            {customerName && (
              <>
                <span className="customer-cpf-separator">|</span>
                Cliente: <strong>{customerName}</strong>
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary customer-back-button"
          onClick={onBack}
        >
          SAIR
        </button>
      </div>

      {hasNoCoupons && (
        <div className="customer-promo-invite">
          <h3>Você ainda não possui cupons nesta promoção</h3>
          <p>
            Seu cadastro foi localizado. Para participar da Seleção dos Heróis,
            compre produtos participantes na Rezende Construção e Palmeira
            Tintas. Assim você gera cupons, autentica sua participação e
            concorre aos prêmios da campanha.
          </p>
        </div>
      )}

      <div className="customer-stats-grid">
        <article
          className={getWindowClassName(
            'available',
            'customer-stat-card--highlight'
          )}
        >
          <button
            type="button"
            className="customer-window-button"
            onClick={() => toggleWindow('available')}
            aria-expanded={activeWindow === 'available'}
          >
            <span>
              <span className="customer-stat-label">Cupons para validar</span>
              <strong className="customer-stat-value">{availableCoupons.length}</strong>
            </span>
            {renderWindowToggle('available')}
          </button>

          {activeWindow === 'available' && (
            <>
              {availableCoupons.length > 0 && (
                <div className="customer-selection-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSelectAll}
                    disabled={loading}
                  >
                    Selecionar todos
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClearSelection}
                    disabled={loading || selectedCoupons.length === 0}
                  >
                    Limpar seleção
                  </button>
                </div>
              )}

              {availableCoupons.length === 0 ? (
                renderBuyMoreMessage('Nenhum cupom pendente')
              ) : (
                <>
                  <div className="customer-selection-toolbar">
                    <p>
                      {selectedCoupons.length} cupom(ns) selecionado(s) para
                      autenticação
                    </p>
                  </div>

                  <div className="customer-coupon-grid">
                    {availableCoupons.map((coupon) => (
                      <article
                        key={coupon.id}
                        className={`customer-coupon-card ${
                          selectedCouponIds.includes(coupon.id) ? 'selected' : ''
                        }`}
                      >
                        <div className="customer-validated-ribbon pending">
                          Cupom não validado
                        </div>
                        <label className="customer-select-row">
                          <input
                            type="checkbox"
                            checked={selectedCouponIds.includes(coupon.id)}
                            onChange={() => toggleCouponSelection(coupon.id)}
                            disabled={loading}
                          />
                          <span>Selecionar este cupom</span>
                        </label>

                        <div className="customer-coupon-card-header">
                          <div>
                            <span className="customer-coupon-label">Cupom</span>
                            <strong>{coupon.code}</strong>
                          </div>

                          {renderStatusBadge(coupon)}
                        </div>

                        {renderCouponDetails(coupon)}
                      </article>
                    ))}
                  </div>

                  {formError && <p className="customer-form-error">{formError}</p>}

                  <div className="customer-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleValidate}
                      disabled={loading}
                    >
                      {loading
                        ? 'Autenticando...'
                        : 'Autenticar cupons selecionados'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </article>

        <article
          className={getWindowClassName(
            'validated',
            'customer-stat-card--validated'
          )}
        >
          <button
            type="button"
            className="customer-window-button"
            onClick={() => toggleWindow('validated')}
            aria-expanded={activeWindow === 'validated'}
          >
            <span>
              <span className="customer-stat-label">Cupons validados</span>
              <strong className="customer-stat-value">{validatedCoupons.length}</strong>
            </span>
            {renderWindowToggle('validated')}
          </button>

          {activeWindow === 'validated' && (
            <>
              {validatedCoupons.length === 0 ? (
                <div className="customer-empty-state customer-empty-state--soft">
                  <h4>Ainda não há cupons validados</h4>
                  <p>Os cupons autenticados aparecerão aqui.</p>
                </div>
              ) : (
                <>
                  {availableCoupons.length === 0 &&
                    renderBuyMoreMessage('Todos os cupons foram autenticados')}

                  <div className="customer-coupon-grid customer-coupon-grid--validated">
                    {validatedCoupons.map((coupon) => (
                      <article
                        key={coupon.id}
                        className={`customer-coupon-card used ${
                          coupon.isDrawn ? 'drawn' : ''
                        }`}
                      >
                        <div
                          className={`customer-validated-ribbon ${
                            coupon.isDrawn ? 'drawn' : ''
                          }`}
                        >
                          {coupon.isDrawn ? 'Cupom sorteado' : 'Cupom validado'}
                        </div>
                        <div className="customer-coupon-card-header">
                          <div>
                            <span className="customer-coupon-label">Cupom</span>
                            <strong>{coupon.code}</strong>
                          </div>

                          {renderStatusBadge(coupon)}
                        </div>

                        {coupon.isDrawn && (
                          <div className="customer-drawn-alert">
                            <strong>Este cupom foi sorteado</strong>
                            <span className="customer-drawn-prize">
                              Item sorteado: {coupon.prizeItem || 'Item não informado'}
                            </span>
                            <span>
                              {coupon.drawnAt
                                ? `Sorteado em ${new Date(
                                    coupon.drawnAt
                                  ).toLocaleString('pt-BR')}`
                                : 'Procure a equipe da promoção para confirmar os próximos passos.'}
                            </span>
                          </div>
                        )}

                        {renderCouponDetails(coupon)}
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </article>

        <article className={getWindowClassName('total', 'customer-stat-card--total')}>
          <button
            type="button"
            className="customer-window-button"
            onClick={() => toggleWindow('total')}
            aria-expanded={activeWindow === 'total'}
          >
            <span>
              <span className="customer-stat-label">Total de cupons</span>
              <strong className="customer-stat-value">{coupons.length}</strong>
            </span>
            {renderWindowToggle('total')}
          </button>

          {activeWindow === 'total' &&
            (coupons.length === 0 ? (
              renderBuyMoreMessage('Você ainda não possui cupons')
            ) : (
              <div className="customer-summary-list">
                {coupons.map((coupon) => renderTotalCoupon(coupon))}
              </div>
            ))}
        </article>
      </div>
    </div>
  );
};

export default CustomerCouponList;

