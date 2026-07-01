# Projeto QR Code - Selecao dos Herois

Aplicacao para consulta, validacao e administracao de cupons da promocao
Selecao dos Herois. O frontend roda em Vite/React e o backend e uma API
FastAPI usada para sincronizacao Autcom/Citel, sorteios e consultas auxiliares.

## URLs de producao

- Frontend: `https://projeto-qrcode-two.vercel.app`
- Backend/API: `https://api-citel-rezende-2.onrender.com`

Nao publique alteracoes sem validar localmente e sem uma janela planejada de
deploy.

## Como rodar localmente

### Requisitos

- Node.js 18+
- npm
- Python 3.11+

### Frontend

1. Instale as dependencias:

```bash
npm install
```

2. Configure variaveis locais do frontend em `.env.local` ou
   `frontend/.env.local`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SYNC_API_URL=
VITE_SUPABASE_COUPONS_TABLE=
```

3. Rode o servidor local:

```bash
npm run dev
```

4. Abra:

```txt
http://localhost:3000
```

### Backend

1. Crie e ative um ambiente Python, se desejar.
2. Instale as dependencias:

```bash
pip install -r backend/requirements.txt
```

3. Configure as variaveis de ambiente do backend:

```env
DB_BACKEND=
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_PASS=
MYSQL_DB=
DB_HOST=
DB_PORT=
DB_USER=
DB_PASS=
DB_NAME=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_KEY=
SYNK_TOKEN=
CITEL_SALES_TABLE=
CITEL_CLIENT_TABLE=
CITEL_MOVEMENT_TABLE=
CITEL_SELLER_TABLE=
```

4. Rode a API localmente:

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

## Validacoes locais

Antes de qualquer deploy, rode:

```bash
npm run build
npx tsc --noEmit
python -m compileall -q backend
npm run dev
```

O `npm run dev` deve ser usado apenas para teste local.

## Como fazer deploy

### Vercel

O frontend usa Vite. Os arquivos que precisam ficar na raiz para o Vercel sao:

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `vercel.json`
- `tsconfig.json`
- `tsconfig.node.json`

Configuracao atual em `vercel.json`:

- framework: `vite`
- build command: `npm run build`
- output directory: `dist`

Deploy manual, somente quando autorizado:

```bash
vercel --prod --yes
```

### Render

O Render usa `render.yaml` na raiz. O backend Docker aponta para:

```txt
infra/docker/Dockerfile
```

O Dockerfile copia `backend/` e inicia:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

## Estrutura do projeto

```txt
projeto-qrcode/
├─ backend/
│  ├─ api/
│  │  ├─ columns.py
│  │  ├─ draw.py
│  │  ├─ health.py
│  │  └─ sync.py
│  ├─ config/
│  ├─ database/
│  ├─ queries/
│  ├─ services/
│  ├─ sql/
│  ├─ utils/
│  ├─ main.py
│  └─ requirements.txt
├─ frontend/
│  ├─ public/
│  ├─ index.html
│  └─ src/
│     ├─ assets/
│     ├─ components/
│     │  ├─ auth/
│     │  ├─ coupons/
│     │  ├─ draw/
│     │  ├─ layout/
│     │  └─ qr/
│     ├─ services/
│     ├─ styles/
│     ├─ App.tsx
│     └─ main.tsx
├─ docs/
├─ scripts/
├─ config/
├─ infra/
│  └─ docker/
├─ .env.example
├─ package.json
├─ render.yaml
├─ vercel.json
├─ vite.config.ts
└─ README.md
```

## Observacoes de manutencao

- `node_modules/`, `dist/`, `__pycache__/`, `*.pyc` e `*.tsbuildinfo` nao devem ser versionados.
- Nao commitar `.env`, `.env.local`, `.env.vercel` ou chaves reais.
- Queries SQL do backend ficam em `backend/queries/`.
- Scripts SQL de Supabase ficam em `backend/sql/`.
- Endpoints FastAPI ficam em `backend/api/`; os caminhos publicos das rotas devem ser preservados.
