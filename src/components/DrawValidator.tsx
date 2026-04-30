import { useState } from 'react';
import './DrawValidator.css';

type ValidationResult = {
  valid: boolean;
  hashMatches: boolean;
  randomAccepted: boolean;
  calculatedHash: string;
  selectedIndex: number | null;
  winner: Record<string, string> | null;
  message: string;
};

const canonicalFields = ['id', 'code', 'cpf', 'document', 'validated_at'];

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const normalizeParticipants = (rawParticipants: unknown) => {
  const participants = Array.isArray(rawParticipants)
    ? rawParticipants
    : Array.isArray((rawParticipants as { participants?: unknown[] })?.participants)
      ? (rawParticipants as { participants: unknown[] }).participants
      : null;

  if (!participants) {
    throw new Error('Cole uma lista JSON de participantes.');
  }

  if (participants.length === 0) {
    throw new Error('A lista de participantes não pode estar vazia.');
  }

  return participants.map((item) => {
    const row = item as Record<string, unknown>;
    return canonicalFields.reduce<Record<string, string>>((record, field) => {
      record[field] = String(row?.[field] ?? '');
      return record;
    }, {});
  });
};

export default function DrawValidator() {
  const [participantsText, setParticipantsText] = useState('');
  const [expectedHash, setExpectedHash] = useState('');
  const [randomValue, setRandomValue] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const canonicalParticipants = normalizeParticipants(
        JSON.parse(participantsText)
      );
      const total = canonicalParticipants.length;
      const calculatedHash = await sha256(stableStringify(canonicalParticipants));
      const normalizedExpectedHash = expectedHash.trim().toLowerCase();
      const rawRandomValue = BigInt(randomValue.trim());
      const randomSpace = 1n << 256n;
      const acceptedLimit = randomSpace - (randomSpace % BigInt(total));
      const randomInRange = rawRandomValue >= 0n && rawRandomValue < randomSpace;
      const randomAccepted = randomInRange && rawRandomValue < acceptedLimit;
      const selectedIndex = randomAccepted
        ? Number(rawRandomValue % BigInt(total))
        : null;
      const winner =
        typeof selectedIndex === 'number'
          ? canonicalParticipants[selectedIndex]
          : null;
      const hashMatches = calculatedHash === normalizedExpectedHash;
      const valid = hashMatches && randomAccepted;

      setResult({
        valid,
        hashMatches,
        randomAccepted,
        calculatedHash,
        selectedIndex,
        winner,
        message: valid
          ? 'Sorteio validado. O hash, o número aleatório e a lista são compatíveis.'
          : 'Sorteio não validado. Confira o hash, o número aleatório bruto e a lista de participantes.',
      });
    } catch (error) {
      setResult({
        valid: false,
        hashMatches: false,
        randomAccepted: false,
        calculatedHash: '',
        selectedIndex: null,
        winner: null,
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível validar os dados informados.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="draw-validator">
      <div className="draw-validator__header">
        <span className="header-kicker">Auditoria pública</span>
        <h2>Validador público do sorteio</h2>
        <p>
          Cole o hash, o número aleatório bruto e a lista canônica de
          participantes. O validador recalcula o hash e o índice vencedor sem
          consultar o banco.
        </p>
      </div>

      <div className="draw-validator__grid">
        <label>
          Hash dos participantes
          <input
            value={expectedHash}
            onChange={(event) => setExpectedHash(event.target.value)}
            placeholder="Ex.: 44d5276d8beb83a78f8e86c38afe16a5..."
          />
        </label>

        <label>
          Número aleatório bruto
          <input
            value={randomValue}
            onChange={(event) => setRandomValue(event.target.value)}
            placeholder="Número inteiro salvo na auditoria"
          />
        </label>
      </div>

      <label className="draw-validator__participants">
        Lista canônica de participantes
        <textarea
          value={participantsText}
          onChange={(event) => setParticipantsText(event.target.value)}
          placeholder='[{"id":"...","code":"...","cpf":"...","document":"...","validated_at":"..."}]'
        />
      </label>

      <div className="draw-validator__actions">
        <button
          className="btn btn-primary"
          onClick={handleValidate}
          disabled={loading}
        >
          {loading ? 'Validando...' : 'Validar sorteio'}
        </button>

        <a className="btn btn-secondary" href="/">
          Voltar para a promoção
        </a>
      </div>

      {result && (
        <div
          className={`draw-validator__result ${
            result.valid ? 'draw-validator__result--valid' : 'draw-validator__result--invalid'
          }`}
        >
          <h3>{result.valid ? 'Válido' : 'Inválido'}</h3>
          <p>{result.message}</p>
          {result.calculatedHash && (
            <dl>
              <div>
                <dt>Hash calculado</dt>
                <dd>{result.calculatedHash}</dd>
              </div>
              <div>
                <dt>Hash informado</dt>
                <dd>{result.hashMatches ? 'Compatível' : 'Diferente'}</dd>
              </div>
              <div>
                <dt>Número aleatório</dt>
                <dd>{result.randomAccepted ? 'Aceito pela amostragem' : 'Rejeitado'}</dd>
              </div>
              <div>
                <dt>Índice vencedor</dt>
                <dd>
                  {typeof result.selectedIndex === 'number'
                    ? `${result.selectedIndex + 1}`
                    : '-'}
                </dd>
              </div>
            </dl>
          )}

          {result.winner && (
            <div className="draw-validator__winner">
              <strong>Cupom calculado como vencedor</strong>
              <pre>{JSON.stringify(result.winner, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
