import React, { useState } from 'react';
import './AuthForm.css';
import { formatCPF } from '../services/supabaseService';

interface AuthFormProps {
  onAuthenticate: (cpf: string) => void;
  loading?: boolean;
}

const AuthForm: React.FC<AuthFormProps> = ({
  onAuthenticate,
  loading = false,
}) => {
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value));
    setErrors((prev) => ({ ...prev, cpf: '' }));
  };

  const validateForm = () => {
    const cpfDigits = cpf.replace(/\D/g, '');
    const newErrors: Record<string, string> = {};

    if (!cpfDigits) {
      newErrors.cpf = 'Digite o CPF para continuar.';
    } else if (cpfDigits.length !== 11) {
      newErrors.cpf = 'O CPF precisa ter 11 números.';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onAuthenticate(cpf.replace(/\D/g, ''));
  };

  return (
    <div className="auth-form-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-badge">Seleção dos Heróis</span>
          <h2>Entre com seu CPF</h2>
          <p>
            Vamos localizar seus cupons, confirmar sua participação e mostrar
            tudo de forma simples para você autenticar sem erro.
          </p>
        </div>

        <div className="auth-guide">
          <strong>Como funciona:</strong>
          <span>1. Digite seu CPF.</span>
          <span>2. Responda à pergunta da promoção.</span>
          <span>3. Escolha os cupons e autentique.</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="cpf">CPF do participante</label>
            <input
              type="text"
              id="cpf"
              value={cpf}
              onChange={(e) => handleCpfChange(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              disabled={loading}
              className={errors.cpf ? 'error' : ''}
              inputMode="numeric"
              autoComplete="off"
              aria-describedby="cpf-help"
            />
            <small id="cpf-help" className="input-help">
              Digite somente o CPF usado na compra. A máscara é aplicada
              automaticamente.
            </small>
            {errors.cpf && <span className="error-message">{errors.cpf}</span>}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Buscando seus cupons...' : 'Ver meus cupons'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthForm;
