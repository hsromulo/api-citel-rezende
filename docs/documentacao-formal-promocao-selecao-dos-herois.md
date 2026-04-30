# Documentação formal técnica e operacional

## Promoção Seleção dos Heróis

**Versão do documento:** 1.1  
**Data:** 30/04/2026  
**Sistema:** Validação de cupons e sorteio auditável da Promoção Seleção dos Heróis  
**Ambientes:** Vercel, Render, Supabase, cron-job.org e banco AUTCOM/Citel  

---

## Controle do documento

### Histórico de versões

| Versão | Data | Descrição | Responsável |
| --- | --- | --- | --- |
| 1.0 | 30/04/2026 | Criação da documentação técnica e operacional da promoção. | Responsável técnico |
| 1.1 | 30/04/2026 | Inclusão de commit hash do backend, validador público, regra de índice zero-based, responsáveis/aprovações e controle formal de mudanças do algoritmo. | Responsável técnico |

### Responsáveis e aprovações

| Papel | Nome | Data | Assinatura/Validação |
| --- | --- | --- | --- |
| Responsável técnico | A preencher | A preencher | A preencher |
| Responsável pela campanha | A preencher | A preencher | A preencher |
| Responsável jurídico | A preencher | A preencher | A preencher |
| Responsável contábil/fiscal | A preencher | A preencher | A preencher |
| Responsável pela auditoria | A preencher | A preencher | A preencher |

### Controle de mudanças do algoritmo

Qualquer alteração no algoritmo de sorteio deve seguir controle formal de mudança, contendo obrigatoriamente:

- nova versão do algoritmo;
- data e hora da alteração;
- commit Git do backend;
- registro de deploy em produção;
- atualização deste documento;
- validação técnica antes de uso oficial;
- aprovação interna dos responsáveis definidos acima.

Sorteios oficiais devem ser executados apenas após confirmação de que a versão documentada, o commit implantado e a estrutura do banco de dados estão compatíveis.

---

## 1. Objetivo

Este documento descreve a arquitetura, o fluxo operacional, os controles de segurança, a rastreabilidade e o mecanismo de sorteio auditável utilizados no sistema da Promoção Seleção dos Heróis.

O objetivo é permitir que a empresa, auditoria, área jurídica, área de tecnologia e eventuais órgãos fiscalizadores compreendam:

- como os cupons são gerados e sincronizados;
- como o cliente consulta e autentica seus cupons;
- como o sorteio é executado;
- quais evidências são salvas;
- como validar tecnicamente um sorteio realizado;
- quais dados ficam públicos e quais ficam restritos.

Este documento é técnico-operacional. Ele não substitui análise jurídica, contabilidade, regulamento oficial da campanha, termo de autorização ou prestação de contas exigidos por órgão competente.

---

## 2. Referências regulatórias oficiais

Conforme página oficial de Promoção Comercial do Ministério da Fazenda, a promoção comercial é a distribuição gratuita de prêmios a título de propaganda, regulamentada pela Lei nº 5.768/1971, pelo Decreto nº 70.951/1972 e pela Portaria SEAE nº 7.638/2022.

Fontes oficiais consultadas:

- Ministério da Fazenda - Promoção Comercial: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/promocao-comercial/promocao-comercial
- Ministério da Fazenda - Legislação aplicável: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/promocao-comercial/promocao-comercial/qual-a-legislacao-e
- Ministerio da Fazenda - Modalidades: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/promocao-comercial/promocao-comercial/quais-as-modalidades-de
- Ministerio da Fazenda - SCPC: https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/despublicados/promocao-comercial/scpc
- Ministerio da Fazenda - Estrutura da SPA: https://www.gov.br/fazenda/pt-br/internet/despublicados/conheca-a-spa

Observação importante: de acordo com as fontes oficiais disponíveis em 30/04/2026, a autorização, regulação, fiscalização e sancionamento de promoções comerciais são atribuídos à Secretaria de Prêmios e Apostas do Ministério da Fazenda, por meio do Sistema de Controle de Promoções Comerciais - SCPC. Qualquer referência operacional à Caixa Econômica Federal deve ser validada pelo jurídico ou contador responsável antes de protocolo oficial.

---

## 3. Escopo do sistema

O sistema cobre:

- sincronização de cupons elegíveis a partir do AUTCOM/Citel;
- consulta de cupons por CPF;
- autenticação de participação pelo cliente;
- registro de cupons validados;
- selecao de item/premio;
- sorteio server-side;
- gravação de resultado público;
- gravação de auditoria restrita;
- exibição de ganhadores ao cliente;
- exportação de históricos administrativos;
- validação pública de sorteio mediante dados fornecidos pela auditoria.

O sistema nao cobre, por si so:

- redação final do regulamento jurídico;
- submissão da promoção no SCPC;
- emissão de certificado de autorização;
- recolhimentos, DARF, comprovantes fiscais ou prestação de contas;
- verificação legal da elegibilidade dos prêmios;
- analise LGPD formal.

---

## 4. Tecnologias utilizadas

### Frontend

- React
- TypeScript
- Vite
- CSS modular por componente
- Supabase JavaScript Client
- Publicacao em Vercel

### Backend

- Python 3
- FastAPI
- SQLAlchemy
- httpx
- Render Web Service

### Banco e autenticacao

- Supabase
- PostgreSQL
- Row Level Security - RLS
- Supabase Auth para acesso administrativo

### Integracoes

- AUTCOM/Citel via banco relacional
- cron-job.org para manter o servico acordado e acionar sincronizacao periodica
- Vercel para frontend publico
- Render para API server-side

---

## 5. Links operacionais

- Site publico de validacao do cliente: https://projeto-qrcode-two.vercel.app
- Area administrativa de validacoes e sorteios: https://projeto-qrcode-two.vercel.app/?admin=1
- Validador publico de sorteio: https://projeto-qrcode-two.vercel.app/?verificador=1
- API backend: https://api-citel-rezende-2.onrender.com
- Health check da API: https://api-citel-rezende-2.onrender.com/health

---

## 6. Componentes do codigo-fonte

### Backend

Arquivo principal:

- `main.py`

Funcoes/endpoints relevantes:

- `run_coupon_sync`: sincronizacao dos cupons do AUTCOM/Citel para Supabase;
- `/sync/trigger`: endpoint usado pelo cron para sincronizacao em segundo plano;
- `/ping`: endpoint leve para manter Render acordado;
- `choose_unbiased_index`: selecao aleatoria sem vies estatistico;
- `/draw`: endpoint server-side que executa o sorteio oficial;
- `build_canonical_participants`: montagem da lista canonica;
- `build_participants_hash`: geracao do hash SHA-256 dos participantes.

### Frontend administrativo

- `src/components/CouponList.tsx`
- `src/components/CouponList.css`

Responsavel por:

- listar validacoes;
- cadastrar itens/premios;
- acionar sorteio no backend;
- mostrar algoritmo oficial;
- mostrar ganhador;
- exportar historico.

### Frontend cliente

- `src/App.tsx`
- `src/components/AuthForm.tsx`
- `src/components/CustomerCouponList.tsx`
- `src/services/supabaseService.ts`

Responsavel por:

- consulta por CPF;
- pergunta de confirmacao;
- validacao de cupons;
- exibicao de cupom sorteado quando aplicavel.

### Validador publico

- `src/components/DrawValidator.tsx`
- `src/components/DrawValidator.css`

Responsavel por:

- receber hash, numero aleatorio bruto e lista canonica;
- recalcular hash;
- verificar se o numero aleatorio e aceito pela regra de rejeicao;
- recalcular indice vencedor;
- indicar se os dados sao validos ou invalidos.

---

## 7. Fluxo geral da promocao

1. Cliente realiza compra no estabelecimento.
2. AUTCOM/Citel registra documento, cliente, CPF, vendedor e cupom elegivel.
3. Cron-job.org aciona periodicamente o backend em `/sync/trigger`.
4. Backend consulta AUTCOM/Citel e grava/atualiza cupons no Supabase.
5. Cliente acessa o site publico e informa CPF.
6. Sistema busca apenas cupons associados ao CPF consultado.
7. Cliente responde a pergunta da campanha.
8. Cliente autentica seus cupons.
9. Cupons autenticados sao gravados na tabela `validations`.
10. Administrador acessa a area administrativa.
11. Administrador escolhe ou cadastra o item/premio.
12. Administrador aciona o sorteio.
13. Backend executa o sorteio no servidor.
14. Resultado publico e salvo em `draws`.
15. Trilha completa de auditoria e salva em `draw_audits`.
16. Cliente contemplado, ao consultar CPF, visualiza o popup de cupom sorteado.

---

## 8. Tabelas principais

### `coupons`

Armazena cupons sincronizados a partir do AUTCOM/Citel.

Campos relevantes:

- `code`: codigo do cupom;
- `cpf`: CPF do cliente;
- `document_number`: documento de venda;
- `document_type`: tipo do documento;
- `customer_code`: codigo do cliente;
- `customer_name`: nome do cliente;
- `seller_code`: codigo do vendedor;
- `seller_name`: nome do vendedor;
- dados complementares de compra e validade.

### `validations`

Armazena cupons autenticados pelo cliente.

Campos relevantes:

- `id`: identificador interno;
- `code`: codigo do cupom autenticado;
- `cpf`: CPF;
- `document`: documento;
- `validated_at`: data/hora da autenticacao.

### `draws`

Tabela de resultado publico do sorteio.

Campos relevantes:

- `id`: identificador do sorteio;
- `validation_id`: validacao sorteada;
- `prize_item`: item/premio;
- `code`: cupom vencedor;
- `cpf`: CPF do contemplado;
- `document`: documento vinculado;
- `customer_name`: nome do cliente;
- `seller_name`: vendedor;
- `algorithm_version`: versao do algoritmo;
- `pool_size`: total de participantes;
- `random_value`: numero aleatorio bruto;
- `selected_index`: indice tecnico sorteado, com base zero;
- `participants_hash`: hash da lista de participantes;
- `drawn_at`: data/hora do sorteio.

Observacao: esta tabela e usada para exibicao do resultado e consulta do cliente. Ela nao deve conter a lista completa de participantes.

### `draw_audits`

Tabela restrita de auditoria completa.

Campos relevantes:

- `draw_id`: referencia ao sorteio em `draws`;
- `algorithm_version`: versao do algoritmo;
- `algorithm_updated_at`: data de alteracao do algoritmo;
- `commit_hash`: commit Git do backend implantado no Render no momento do sorteio;
- `pool_size`: total de participantes;
- `selected_index`: indice tecnico sorteado, com base zero;
- `random_value`: numero aleatorio bruto usado no calculo;
- `participants_hash`: hash SHA-256 da lista canonica;
- `participants`: lista canonica completa;
- `admin_user_id`: usuario administrador que executou o sorteio;
- `created_at`: data/hora da gravacao.

Esta tabela possui RLS habilitado e deve permanecer restrita a usuarios autenticados/autorizados, pois pode conter dados pessoais.

---

## 9. Algoritmo oficial do sorteio

### Versao

`server-rejection-sampling-256-v1`

### Linguagem e ambiente

Python 3 / FastAPI

### Ultima alteracao

30/04/2026 as 09:18

### Commit do codigo em producao

Cada sorteio grava em `draw_audits.commit_hash` o commit Git do backend informado pelo ambiente de producao. No Render, essa informacao vem da variavel padrao `RENDER_GIT_COMMIT`.

Finalidade:

- identificar o codigo exato implantado no momento do sorteio;
- permitir comparacao com o historico do repositorio;
- reduzir dependencia de declaracoes manuais sobre qual versao estava em producao;
- fortalecer a evidencia externa de auditoria.

### Principios

- Execucao exclusivamente no backend;
- nao utiliza `Math.random`;
- nao depende do navegador do administrador;
- usa fonte criptografica do servidor;
- evita vies estatistico por amostragem de rejeicao;
- vincula o numero aleatorio bruto ao indice vencedor;
- registra hash antes do resultado;
- salva evidencias em banco.

### Pseudocodigo documentado

```text
participantes = consulta_unica_validations_ordenada_por_validated_at_e_id
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
salvar_auditoria_restrita_em_draw_audits(hashDosParticipantes, participantes_canonicos)
```

### Implementacao real no backend

```python
def choose_unbiased_index(total: int) -> tuple[int, int]:
  random_space = 1 << 256
  limit = random_space - (random_space % total)

  while True:
    random_value = secrets.randbits(256)
    if random_value < limit:
      return random_value % total, random_value
```

---

## 10. Justificativa tecnica do sorteio

### Fonte aleatoria

O algoritmo usa `secrets.randbits(256)` no backend Python. O modulo `secrets` e apropriado para geracao de valores criptograficamente fortes.

### Ausencia de vies

O sistema nao aplica simplesmente `random_value % total` em qualquer numero gerado. Antes, calcula o maior limite aceito divisivel pelo total de participantes. Valores fora desse limite sao rejeitados e um novo numero e gerado.

Esse processo e conhecido como amostragem por rejeicao. Ele evita que determinadas posicoes tenham probabilidade ligeiramente maior.

### Vinculo entre numero bruto e vencedor

O `random_value` salvo em auditoria e o proprio numero usado para calcular:

```text
selected_index = random_value % pool_size
```

desde que `random_value` esteja abaixo do limite aceito.

Assim, o resultado pode ser revalidado posteriormente.

Observacao: `selected_index` e um indice tecnico com base zero. Portanto, `selected_index = 1` corresponde ao segundo item da lista canonica; `selected_index = 2` corresponde ao terceiro item.

### Hash da lista

Antes da selecao do vencedor, o sistema gera um SHA-256 da lista canonica dos participantes.

Se qualquer item da lista for alterado, removido, inserido ou reordenado, o hash calculado sera diferente.

---

## 11. Lista canonica de participantes

A lista canonica e salva com campos fixos:

- `id`
- `code`
- `cpf`
- `document`
- `validated_at`

Finalidade:

- reduzir variacao causada por campos auxiliares;
- padronizar a auditoria;
- permitir revalidacao;
- evitar dependencia de dados de exibicao, como nome de cliente ou vendedor.

---

## 12. Validador publico do sorteio

URL:

https://projeto-qrcode-two.vercel.app/?verificador=1

O validador permite que qualquer pessoa, de posse dos dados de auditoria fornecidos pela empresa, confirme se:

- o hash informado corresponde a lista canonica;
- o numero aleatorio bruto esta dentro do intervalo aceito;
- o indice vencedor e recalculavel;
- o cupom vencedor e consistente com os dados informados.

Entradas:

- `participants_hash`;
- `random_value`;
- `participants`.

Saida:

- valido ou invalido;
- hash calculado;
- compatibilidade do hash;
- aceitacao do numero aleatorio;
- indice tecnico vencedor, com base zero;
- posicao humana na lista, com base um;
- cupom calculado como vencedor.

Observacao: o validador nao busca dados no banco. Isso e proposital. A empresa deve fornecer os dados necessarios em contexto de auditoria, preservando LGPD e evitando exposicao publica automatica de CPF e lista de participantes.

---

## 13. Controle de acesso

### Area publica

Disponivel para clientes:

- consulta por CPF;
- autenticacao de cupons;
- exibicao de cupons do cliente;
- exibicao de cupom sorteado quando aplicavel;
- validador publico mediante dados fornecidos.

### Area administrativa

Acesso por login administrativo via Supabase Auth.

Permite:

- visualizar validacoes;
- exportar dados;
- cadastrar itens/premios;
- realizar sorteio;
- visualizar historico de sorteios.

### Auditoria restrita

Tabela `draw_audits` com RLS habilitado.

Deve ser acessada somente por usuarios autorizados, pois contem lista de participantes com dados pessoais.

---

## 14. LGPD e protecao de dados

O sistema trata dados pessoais, incluindo CPF, nome e historico de cupons.

Controles implementados:

- dados de auditoria completa ficam em tabela restrita;
- lista completa de participantes nao e exibida publicamente;
- resultado publico nao contem lista completa da promocao;
- validador publico nao consulta banco automaticamente;
- cliente consulta apenas informando CPF;
- area administrativa exige login;
- token de sincronizacao fica em variavel de ambiente no Render.

Recomendacoes:

- formalizar base legal para tratamento dos dados;
- informar no regulamento como CPF e cupons serao tratados;
- restringir usuarios com acesso ao Supabase;
- evitar compartilhar prints de tokens, chaves ou tabelas com CPF;
- definir prazo de retencao dos dados;
- definir responsavel interno por atendimento a solicitacoes de titulares.

Orientação específica para auditoria externa:

- a lista canônica de participantes deve ser compartilhada apenas quando houver necessidade técnica, jurídica, regulatória ou de auditoria;
- quando possível, o compartilhamento deve ocorrer em ambiente controlado, com registro de quem recebeu os dados e finalidade de uso;
- a divulgação pública irrestrita da lista completa de participantes não é recomendada, pois a lista contém CPF e outros dados vinculados à participação;
- o validador público deve ser usado preferencialmente com acompanhamento interno, jurídico ou auditorial, quando envolver dados pessoais identificáveis.

---

## 15. Sincronizacao com AUTCOM/Citel

A sincronizacao ocorre via backend Render.

Endpoint:

```text
/sync/trigger
```

Protecao:

- token `SYNK_TOKEN`/`SYNC_TOKEN`;
- execucao em segundo plano;
- lock para evitar sincronizacoes simultaneas;
- protecao contra sincronizacao automatica pesada de resumo de clientes.

Cron-job.org aciona periodicamente:

- `/ping`: manter Render acordado;
- `/sync/trigger`: sincronizar novos cupons.

---

## 16. Evidencias por sorteio

Para cada sorteio, recomenda-se arquivar:

- print da tela do ganhador;
- linha correspondente da tabela `draws`;
- linha correspondente da tabela `draw_audits`;
- `participants_hash`;
- `random_value`;
- `selected_index`;
- `pool_size`;
- `participants`;
- versao do algoritmo;
- commit Git do backend;
- data/hora do sorteio;
- usuario administrador;
- item/premio sorteado;
- comprovante de propriedade/aquisicao do premio;
- regulamento vigente;
- numero de autorizacao, quando aplicavel;
- resultado do validador publico.

---

## 17. Procedimento operacional de sorteio

Antes do sorteio:

1. Confirmar que o cron esta sincronizando com sucesso.
2. Confirmar que a lista de validacoes esta atualizada.
3. Confirmar que o premio esta cadastrado corretamente.
4. Confirmar que ha autorizacao/regulamento aplicavel.
5. Exportar ou registrar evidencias previas, se exigido.

Durante o sorteio:

1. Acessar `?admin=1`.
2. Fazer login administrativo.
3. Escolher o item/premio.
4. Clicar em `Realizar sorteio`.
5. Registrar o resultado exibido.

Apos o sorteio:

1. Conferir linha em `draws`.
2. Conferir linha em `draw_audits`.
3. Copiar `participants_hash`, `random_value` e `participants`.
4. Validar em `?verificador=1`, se necessario.
5. Arquivar evidencias.
6. Comunicar o contemplado conforme regulamento.

---

## 18. Procedimento de validacao publica

1. Abrir https://projeto-qrcode-two.vercel.app/?verificador=1
2. Colar `participants_hash`.
3. Colar `random_value`.
4. Colar JSON completo de `participants`.
5. Clicar em `Validar sorteio`.
6. Conferir se o resultado e `Valido`.
7. Registrar print/PDF da validacao.

---

## 19. Limitacoes conhecidas

- O sistema tecnico nao substitui autorizacao oficial.
- A validade juridica depende do regulamento aprovado e do cumprimento das exigencias do orgao competente.
- O validador publico exige que a empresa forneca a lista canonica quando necessario.
- A lista canonica contem CPF; portanto, sua divulgacao deve observar LGPD e orientacao juridica.
- Alteracoes futuras no algoritmo devem gerar nova versao e nova data de alteracao.
- Mudancas na legislacao ou no SCPC devem ser acompanhadas pelo responsavel juridico/contabil.

---

## 20. Checklist para regulamentacao e governanca

Checklist tecnico:

- [ ] Backend em producao respondendo `/health`;
- [ ] Cron de sincronizacao ativo;
- [ ] Supabase sem alertas criticos de performance;
- [ ] Tabela `draws` criada;
- [ ] Tabela `draw_audits` criada;
- [ ] RLS de `draw_audits` ativo;
- [ ] Login administrativo funcionando;
- [ ] Sorteio de teste realizado;
- [ ] Validador publico testado;
- [ ] Exportacao de validacoes funcionando;
- [ ] Exportacao de sorteados funcionando.

Checklist regulatorio/juridico:

- [ ] Definir modalidade da promocao;
- [ ] Validar regulamento com juridico;
- [ ] Validar premios permitidos;
- [ ] Validar valor total dos premios;
- [ ] Conferir requisitos fiscais da empresa;
- [ ] Protocolar no SCPC, se aplicavel;
- [ ] Arquivar certificado/autorizacao;
- [ ] Definir forma de divulgacao dos contemplados;
- [ ] Definir prazo e forma de entrega dos premios;
- [ ] Definir prestacao de contas;
- [ ] Definir politica LGPD e retencao de dados.

---

## 21. Conclusao

O sistema implementa sorteio server-side com fonte aleatoria criptograficamente segura, amostragem por rejeicao para evitar vies, hash SHA-256 da lista canonica de participantes e trilha de auditoria restrita.

Do ponto de vista tecnico, o desenho permite comprovar:

- qual lista participou;
- que a lista nao foi alterada sem mudar o hash;
- qual numero aleatorio bruto foi usado;
- qual indice foi sorteado;
- qual cupom foi contemplado;
- qual versao do algoritmo estava vigente;
- qual commit do backend estava implantado;
- quando e por qual usuario administrativo o sorteio foi executado.

Para uso em promocao regulamentada, este conjunto deve ser acompanhado de regulamento formal, autorizacao/protocolo no orgao competente, controles LGPD, comprovantes de premios e processo de prestacao de contas.
