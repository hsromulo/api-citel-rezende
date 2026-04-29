import React from 'react';
import './ValidationResult.css';

interface CouponData {
  id: string;
  code: string;
  cpf?: string;
  documentNumber?: string;
  isValid: boolean;
  message: string;
  title?: string;
}

interface ValidationResultProps {
  couponData: CouponData;
  onScanAgain: () => void;
  onHome: () => void;
  primaryButtonLabel?: string;
  secondaryButtonLabel?: string;
}

const ValidationResult: React.FC<ValidationResultProps> = ({
  couponData,
  onScanAgain,
  onHome,
  primaryButtonLabel = 'Validar Outro Cupom',
  secondaryButtonLabel = 'Voltar ao Início',
}) => {
  const title =
    couponData.title || (couponData.isValid ? 'Cupom Validado' : 'Cupom Inválido');

  return (
    <div className="validation-container">
      <div className={`result-card ${couponData.isValid ? 'success' : 'error'}`}>
        <div className="result-icon">
          {couponData.isValid ? (
            <span className="icon-success">✓</span>
          ) : (
            <span className="icon-error">✕</span>
          )}
        </div>

        <h2>{title}</h2>

        <p className="result-message">{couponData.message}</p>

        {(couponData.code || couponData.cpf || couponData.documentNumber) && (
          <div className="coupon-details">
            {couponData.code && (
              <p>
                <strong>Código:</strong>
                <span className="code">{couponData.code}</span>
              </p>
            )}
            {couponData.cpf && (
              <p>
                <strong>CPF:</strong>
                <span className="code">{couponData.cpf}</span>
              </p>
            )}
            {couponData.documentNumber && (
              <p>
                <strong>Documento:</strong>
                <span className="code">{couponData.documentNumber}</span>
              </p>
            )}
          </div>
        )}

        <div className="button-group">
          <button className="btn btn-primary" onClick={onScanAgain}>
            {primaryButtonLabel}
          </button>
          <button className="btn btn-secondary" onClick={onHome}>
            {secondaryButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationResult;
