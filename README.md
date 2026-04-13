# Creditflow Core

![Architecture](https://img.shields.io/badge/architecture-monorepo-0f172a)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-15803d)
![TypeScript](https://img.shields.io/badge/typescript-5.9-2563eb)
![API](https://img.shields.io/badge/api-fastify-000000)
![Prisma](https://img.shields.io/badge/orm-prisma-2d3748)
![Database](https://img.shields.io/badge/database-neon_postgres-14b8a6)
![Finance Engine](https://img.shields.io/badge/finance_engine-deterministic-f59e0b)
![AI](https://img.shields.io/badge/ai-groq-7c3aed)
[![CodeQL Advanced](https://github.com/EstandarMustaq/creditflow-core/actions/workflows/codeql.yml/badge.svg)](https://github.com/EstandarMustaq/creditflow-core/actions/workflows/codeql.yml)
[![APIsec](https://github.com/EstandarMustaq/creditflow-core/actions/workflows/apisec-scan.yml/badge.svg)](https://github.com/EstandarMustaq/creditflow-core/actions/workflows/apisec-scan.yml)

Modular back-office monorepo for microcredit operations, repayment tracking, collections, and financial servicing. `creditflow-core` bundles the API, background worker, deterministic finance engine, Neon Postgres integration, AI-assisted analysis, file import, CRC export, and operational notifications.

The platform is built around a strict separation:

- deterministic, testable, auditable financial computation
- operational automation, analysis, reminders, and external integrations

## Value proposition

- Centralizes contracts, installments, payments, outstanding balance, and collections in one backend.
- Prevents AI from inventing financially sensitive values.
- Supports dashboards, ERPs, CRMs, mobile apps, client portals, and collections tools over a single API.
- Runs real-time flows and recurring background routines in the same codebase.

## Golden rule

AI must not calculate money.

AI may interpret data, summarize risk, suggest renegotiation, generate collection copy, and support operational analysis. The calculation of:

- installment count
- interest
- penalty interest
- delinquency
- remaining balance
- total paid

must remain inside `packages/finance-engine`.

This keeps the platform predictable, traceable, and ready for audit, compliance, and financial operations.

## Architecture

### Apps

- `apps/api` - primary API for auth, clients, loans, payments, statements, AI, file intake, CRC export, health, and reminders
- `apps/worker` - scheduled routines for loan recalculation, overdue detection, reminders, and worker heartbeat

### Packages

- `packages/auth` - JWT, password hashing, and RBAC
- `packages/db` - Prisma Client, persistence orchestration, and Neon integration
- `packages/finance-engine` - schedule generation, penalty interest, delinquency, balance, partial payments, renegotiation
- `packages/ai-finance` - Groq integration for text analysis based on computed finance data
- `packages/notifications` - email and notification delivery
- `packages/file-exchange` - CSV intake templates and file parsing
- `packages/calendar` - due date and operational event scheduling
- `packages/shared` - shared types and cross-app contracts

## Recommended finance flow

1. Create the microcredit contract.
2. Generate the installment schedule.
3. Calculate the base installment amount.
4. Apply period interest.
5. Check delinquency.
6. Apply late fees or penalty rules when applicable.
7. Update the remaining balance.
8. Send the automatic reminder.
9. Repeat the process daily in the background worker.

## Domain formulas

```txt
outstanding_balance = remaining_principal + open_interest + late_fee - applied_payments
days_overdue = max(0, today - due_date)
penalty_interest = overdue_amount * daily_penalty_rate * days_overdue
remaining_amount = contract_total - total_paid
```

## Supported automation cases

- If an installment is due today and no payment has arrived, the system can mark it as `AT_RISK`.
- If the due date passes, the installment moves to `OVERDUE`.
- If a partial payment is posted, the system recalculates balance and contract status.
- If a renegotiation occurs, the installment plan can be regenerated from the open balance.
- If overdue days exceed a configured threshold, the worker issues an automatic reminder.

## Main endpoints

### Authentication

- `POST /auth/register`
- `POST /auth/login`

### Credit operations

- `POST /clients`
- `GET /clients`
- `GET /clients/:id/statement`
- `POST /loans`
- `POST /loans/simulate`
- `POST /loans/:id/schedule`
- `GET /loans/:id/balance`
- `POST /payments`

### Automation and operations

- `GET /health`
- `POST /reminders/send`
- `POST /ai/analysis`
- `POST /files/import`
- `GET /files/template`
- `GET /crc/export`
- `POST /calendar/build`
- `GET /reports/portfolio`

## Core data model

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

## Getting started

1. Create the environment file:

```bash
cp .env.example .env
```

2. Define at least:

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

3. Install dependencies:

```bash
pnpm install
```

4. Generate Prisma Client:

```bash
pnpm --filter @creditflow-core/db generate
```

5. Start the API:

```bash
pnpm dev:api
```

6. Start the worker:

```bash
pnpm dev:worker
```

## Repository governance

Use these files as the operational baseline of the project:

- contribution: [CONTRIBUTING.md](CONTRIBUTING.md)
- security: [SECURITY.md](SECURITY.md)
- code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- license: [LICENSE](LICENSE)

## Dashboard integration example

A web dashboard for collections, servicing, or risk monitoring can consume `creditflow-core` to display:

- active portfolio
- at-risk contracts
- overdue contracts
- outstanding balance by client
- payment history
- delinquency ranking
- pending reminders

### Example: fetch consolidated portfolio

```ts
const response = await fetch('http://localhost:3000/reports/portfolio', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const portfolio = await response.json();

console.log(portfolio);
```

### Example: fetch client statement

```ts
const response = await fetch(`http://localhost:3000/clients/${clientId}/statement`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const statement = await response.json();

console.log(statement.loans);
console.log(statement.summary);
```

## External application integration

`creditflow-core` can be consumed by:

- admin dashboards
- collections CRMs
- mobile apps for field agents
- client self-service portals
- financial ERPs
- call center systems

### Example: post a payment from a mobile app

```ts
await fetch('http://localhost:3000/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    loanId: 'loan_123',
    amount: 2500,
    paidAt: new Date().toISOString(),
    reference: 'mobile-agent-collection',
  }),
});
```

### Example: retrieve loan balance for a client portal

```ts
const response = await fetch(`http://localhost:3000/loans/${loanId}/balance`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const balance = await response.json();

console.log(balance.summary.outstandingBalance);
console.log(balance.summary.totalPaid);
console.log(balance.schedule);
```

### Example: request AI-assisted analysis without delegating financial calculation

```ts
const response = await fetch('http://localhost:3000/ai/analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    loanId: 'loan_123',
    notes: 'The client requested renegotiation after a recent income shock.',
  }),
});

const analysis = await response.json();
console.log(analysis);
```

## Integration advantage

Instead of spreading finance rules across several applications, `creditflow-core` acts as the central backend:

- the dashboard reads portfolio indicators
- the mobile app records collections
- the portal shows balances and due dates
- the worker runs background automation
- the AI layer receives already-computed financial values

That keeps every channel aligned to the same financial language.

## Quality and validation

- type-safe with TypeScript
- payload validation with Zod
- persistence with Prisma
- serverless Postgres with Neon
- isolated and reusable finance engine
- separate worker for daily processing

## Suggested roadmap

This roadmap is aimed at the technical team responsible for taking `creditflow-core` from a functional base to a production-grade microcredit and collections platform.

- versioned Prisma migrations for production
- refresh tokens and session management
- BullMQ queues for collections and notifications
- external payment webhooks
- multi-tenant support by financial institution
- metrics and observability
