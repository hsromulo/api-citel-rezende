# Validador de QR Code - Rezende Materiais para Construção

Um sistema moderno e responsivo para validação de cupons da promoção Rezende, com autenticação manual e leitura de QR Code.

## 🎯 Funcionalidades

- ✅ **Autenticação Manual** - Formulário com CPF, código do cupom e número do documento
- ✅ **Leitor de QR Code** - Acessa a câmera do celular para escanear cupons
- ✅ **Validação em Tempo Real** - Conecta ao Supabase para validar cupons
- ✅ **Lista Administrativa** - Visualização de cupons validados (requer login)
- ✅ **Design Responsivo** - Otimizado para dispositivos móveis
- ✅ **Cores Rezende** - Interface com a identidade visual corporativa
- ✅ **PWA Ready** - Funciona offline e instalável como app

## 🚀 Fluxo do Usuário

1. **Cliente recebe QR Code** que direciona para o site
2. **Preenche formulário** com:
   - CPF (com máscara automática)
   - Código do cupom
   - Número do documento fiscal
3. **Clica em "Autenticar Cupom"**
4. **Recebe resultado** da validação
5. **Administradores** podem fazer login para ver lista de cupons validados

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 16+
- npm ou yarn

### Instalação

1. Clone o repositório:
```bash
git clone seu-repo
cd projeto-qrcode
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Adicione suas credenciais Supabase no arquivo `.env`:
```
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

5. Abra [http://localhost:3000](http://localhost:3000) no seu navegador

## 🛠️ Scripts Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Cria build otimizado para produção
- `npm run preview` - Visualiza o build de produção
- `npm run lint` - Executa linter do projeto

## 📱 Estrutura do Projeto

```
src/
├── components/
│   ├── AuthForm.tsx         # Formulário de autenticação manual
│   ├── AuthForm.css
│   ├── QRScanner.tsx        # Leitor de QR Code
│   ├── QRScanner.css
│   ├── ValidationResult.tsx # Resultado da validação
│   ├── ValidationResult.css
│   ├── CouponList.tsx       # Lista de cupons validados
│   ├── CouponList.css
│   ├── Login.tsx            # Formulário de login admin
│   └── Login.css
├── services/
│   └── supabaseService.ts   # Integração com Supabase
├── App.tsx                  # Componente principal
├── App.css                  # Estilos globais com cores Rezende
├── main.tsx                 # Ponto de entrada
└── vite-env.d.ts            # Tipos do Vite
```

## 🎨 Paleta de Cores Rezende

- **Azul Escuro (Primary)**: `#003d7a` - Confiança e profissionalismo
- **Azul Corporativo (Secondary)**: `#0066cc` - Destaque
- **Laranja (Accent)**: `#ff6b35` - Energia e dinamismo
- **Cinza Claro**: `#f5f5f5` - Fundo
- **Branco**: `#ffffff` - Base

## 🔧 Configuração do Supabase

### Tabela: `coupons`

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(255) UNIQUE NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  category VARCHAR(255),
  expiry_date TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📖 Documentação

### AuthForm Component

Formulário principal para autenticação manual de cupons.

Props:
- `onAuthenticate: (data) => void` - Callback com dados do formulário
- `onScanQR: () => void` - Callback para alternar para scanner QR
- `loading?: boolean` - Estado de carregamento

Campos:
- **CPF** - Com máscara automática (000.000.000-00)
- **Código do Cupom** - Campo texto obrigatório
- **Número do Documento** - Campo texto obrigatório

### QRScanner Component

Componente responsável pelo acesso à câmera e leitura de QR Codes.

Props:
- `onScanned: (code: string) => void` - Callback ao detectar código
- `onCancel: () => void` - Callback para cancelar leitura

### ValidationResult Component

Exibe resultado da validação do cupom.

Props:
- `couponData: CouponData` - Dados do cupom validado
- `onScanAgain: () => void` - Escanear novo cupom
- `onHome: () => void` - Voltar ao início

### supabaseService

Funções para validação de cupons:

- `validateCoupon(code: string)` - Valida um cupom
- `markCouponAsUsed(couponId: string)` - Marca cupom como usado

## 🌐 Navegadores Suportados

- Chrome/Chromium 90+
- Safari 14+
- Firefox 88+
- Edge 90+

## � Fluxo de Autenticação

### Para Clientes:
1. Recebem QR Code que direciona para o site
2. Preenchem CPF, código do cupom e número do documento
3. Clicam em "Autenticar Cupom"
4. Recebem confirmação de validação

### Para Administradores:
1. Clicam no botão "Admin" no header
2. Fazem login com email e senha
3. Visualizam lista completa de cupons validados
4. Podem fazer logout a qualquer momento

## ⚠️ Notas Importantes

- O sistema requer conexão com Supabase para funcionar
- A validação de cupons marca automaticamente como "usado"
- Apenas administradores logados podem ver a lista de cupons validados
- O formulário de CPF inclui validação de formato brasileiro
