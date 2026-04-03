# Creditflow Core Monorepo

![Monorepo](https://img.shields.io/badge/architecture-monorepo-0f172a)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-15803d)
![TypeScript](https://img.shields.io/badge/typescript-5.x-2563eb)
![Fastify](https://img.shields.io/badge/api-fastify-000000)
![Prisma](https://img.shields.io/badge/orm-prisma-2d3748)
![Neon](https://img.shields.io/badge/database-neon_postgres-14b8a6)
![Finance Engine](https://img.shields.io/badge/finance_engine-determin%C3%ADstico-f59e0b)
![AI](https://img.shields.io/badge/ai-groq-7c3aed)

Back-end modular para operações de microcrédito, cobrança e acompanhamento financeiro. O `creditflow-core` concentra API, worker, motor financeiro auditável, integração com Neon Postgres, análise assistida por IA, importação/exportação em Excel e notificações automáticas.

O foco do projeto é separar claramente duas camadas:

- cálculo financeiro determinístico, testável e auditável
- automação operacional, análise, alertas e integração com aplicações externas

## Proposta de valor

- Centraliza contratos, prestações, pagamentos, saldo remanescente e cobrança em um único núcleo.
- Evita que IA “invente” valores financeiros sensíveis.
- Permite integrar dashboards, ERPs, CRMs, apps móveis e portais de cobrança sobre uma API própria.
- Suporta operação em tempo real e rotinas em background no mesmo monorepo.

## Regra de ouro

A IA não calcula dinheiro.

Ela pode interpretar dados, resumir risco, sugerir renegociação, gerar texto de cobrança e apoiar análise operacional. Mas os cálculos de:

- número de prestações
- juros
- mora
- atraso
- remanescente
- total pago

ficam exclusivamente no `packages/finance-engine`.

Isso garante previsibilidade, rastreabilidade e confiança para auditoria, compliance e operações financeiras.

## Arquitetura

### Apps

- `apps/api` — API principal para autenticação, clientes, contratos, pagamentos, extratos, IA, Excel e lembretes
- `apps/worker` — rotinas agendadas para recalcular contratos, identificar atraso e disparar lembretes

### Packages

- `packages/auth` — JWT, password hashing e RBAC
- `packages/db` — Prisma Client, orquestração de persistência e integração com Neon
- `packages/finance-engine` — cronograma, mora, atraso, saldo, pagamento parcial, renegociação
- `packages/ai-finance` — integração com Groq para análise textual orientada por dados calculados
- `packages/notifications` — e-mail e notificações
- `packages/excel` — importação e exportação XLSX
- `packages/calendar` — agenda de vencimentos e eventos operacionais
- `packages/shared` — tipos e contratos comuns

## Fluxo financeiro recomendado

1. Criar contrato do microcrédito.
2. Gerar cronograma de prestações.
3. Calcular valor base da parcela.
4. Aplicar juros do período.
5. Verificar atraso.
6. Calcular mora ou multas, se existirem.
7. Atualizar saldo remanescente.
8. Enviar lembrete automático.
9. Repetir o processo em background diariamente.

## Fórmulas base do domínio

```txt
saldo_devedor = principal_restante + juros_em_aberto + multa_por_atraso - pagamentos_efetuados
dias_atraso = max(0, hoje - vencimento)
juros_mora = saldo_em_atraso × taxa_mora_diaria × dias_atraso
remanescente = total_contrato - total_pago
```

## Casos de automação suportados

- Se a prestação vence hoje e não entrou pagamento, o sistema pode marcar como `AT_RISK`.
- Se passar do vencimento, a prestação passa para `OVERDUE`.
- Se houver pagamento parcial, o sistema recalcula saldo e estado do contrato.
- Se houver renegociação, o plano pode ser regenerado sobre o saldo aberto.
- Se o atraso ultrapassar um limite configurado, o worker gera lembrete automático.

## Endpoints principais

### Autenticação

- `POST /auth/register`
- `POST /auth/login`

### Operação de crédito

- `POST /clients`
- `GET /clients`
- `GET /clients/:id/statement`
- `POST /loans`
- `POST /loans/simulate`
- `POST /loans/:id/schedule`
- `GET /loans/:id/balance`
- `POST /payments`

### Automação e suporte operacional

- `POST /reminders/send`
- `POST /ai/analysis`
- `POST /excel/import`
- `GET /excel/export`
- `GET /excel/template`
- `POST /calendar/build`
- `GET /reports/portfolio`

## Modelo de dados principal

- `users`
- `roles`
- `clients`
- `loan_contracts`
- `installment_plans`
- `installments`
- `payments`
- `reminders`
- `audit_logs`
- `ai_events`

## Como usar

1. Configure o ambiente:

```bash
cp .env.example .env
```

2. Defina pelo menos:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
GROQ_API_KEY=your-groq-key
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
```

3. Instale dependências:

```bash
pnpm install
```

4. Gere o client Prisma:

```bash
pnpm --filter @creditflow-core/db generate
```

5. Rode a API:

```bash
pnpm dev:api
```

6. Rode o worker:

```bash
pnpm dev:worker
```

## Exemplo de uso em dashboard

Um dashboard web de cobrança, operações ou risco pode consumir o `creditflow-core` para exibir:

- carteira ativa
- contratos em risco
- contratos em atraso
- saldo em aberto por cliente
- histórico de pagamentos
- ranking de inadimplência
- alertas e lembretes pendentes

### Exemplo: buscar carteira consolidada

```ts
const response = await fetch('http://localhost:3000/reports/portfolio', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const portfolio = await response.json();

console.log(portfolio);
```

### Exemplo: buscar extrato consolidado de cliente

```ts
const response = await fetch(`http://localhost:3000/clients/${clientId}/statement`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const statement = await response.json();

console.log(statement.loans);
console.log(statement.summary);
```

## Exemplo de integração em aplicações externas

O `creditflow-core` pode ser consumido por:

- dashboards administrativos
- CRMs de cobrança
- apps mobile para agentes de crédito
- portais do cliente
- ERPs financeiros
- sistemas de call center

### Exemplo: registrar pagamento vindo de app mobile

```ts
await fetch('http://localhost:3000/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    loanId: 'loan_123',
    amount: 2500,
    paidAt: new Date().toISOString(),
    reference: 'mobile-agent-collection'
  })
});
```

### Exemplo: consultar saldo para portal do cliente

```ts
const response = await fetch(`http://localhost:3000/loans/${loanId}/balance`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const balance = await response.json();

console.log(balance.summary.outstandingBalance);
console.log(balance.summary.totalPaid);
console.log(balance.schedule);
```

### Exemplo: análise assistida por IA sem delegar cálculo financeiro

```ts
const response = await fetch('http://localhost:3000/ai/analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    loanId: 'loan_123',
    notes: 'Cliente pediu renegociação e informou quebra de renda no último mês.'
  })
});

const analysis = await response.json();
console.log(analysis);
```

## Vantagem para integrações

Em vez de espalhar regra financeira em várias aplicações, o `creditflow-core` funciona como backend central:

- a dashboard enxerga indicadores
- o app mobile registra cobranças
- o portal consulta saldos e vencimentos
- o worker executa automações
- a IA recebe valores já calculados pelo engine

Assim, toda a operação fala a mesma linguagem financeira.

## Qualidade e validação

- type-safe com TypeScript
- validação de payloads com Zod
- persistência com Prisma
- banco serverless com Neon
- engine financeiro isolado e reutilizável
- worker separado para processamento diário

## Roadmap sugerido

Este roadmap é voltado para a equipa técnica responsável por levar o `creditflow-core` de uma base funcional para uma operação pronta para produção, especialmente em contextos de fintech, microcrédito, cobrança e back-office financeiro.

- migrations Prisma versionadas para produção
- refresh token e gestão de sessão
- fila com BullMQ para cobrança e notificações
- webhook de pagamentos externos
- multi-tenant por instituição financeira
- métricas e observabilidade
- testes automatizados de API e domínio

## Licença

Este projeto está licenciado sob a GNU General Public License, Version 3, 29 June 2007.

- Licença: `GNU GPLv3`
- Referência oficial: `GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007`
