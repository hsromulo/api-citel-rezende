import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './QRScanner.css';

interface QRScannerProps {
  onScanned: (code: string) => void;
  onCancel: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanned, onCancel }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Inicializar o scanner
    const scanner = new Html5QrcodeScanner(
      containerRef.current.id,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        // Quando um QR Code é detectado
        scanner.clear(); // Para o scanner
        onScanned(decodedText);
      },
      (error) => {
        // Log de erros (opcional)
        console.debug('QR Code scan error:', error);
      }
    );

    scannerRef.current = scanner;

    // Cleanup
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => {
          console.error('Error clearing scanner:', err);
        });
      }
    };
  }, [onScanned]);

  return (
    <div className="qr-scanner-container">
      <div className="scanner-card">
        <h2>Escaneie o QR Code</h2>
        <p className="scanner-instruction">
          Alinhe o código QR do cupom na câmera
        </p>

        <div 
          id="qr-reader"
          ref={containerRef}
          className="qr-reader"
        />

        <div className="scanner-info">
          <p>💡 Dica: Certifique-se de que o código está bem iluminado para melhor leitura</p>
        </div>

        <button 
          className="btn btn-secondary btn-cancel"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default QRScanner;
