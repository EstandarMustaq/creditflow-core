# CoreBank

Dashboard comercial e operacional do ecossistema `creditflow-core`.

Commercial and operational dashboard for the `creditflow-core` ecosystem.

## PT-PT

### O que é

- cockpit para originação, carteira, cobrança e operação assistida por IA
- interface de demonstração comercial sobre dados reais da API
- portal de operação para equipas de agência, back-office e cobrança

### O que faz

- autentica utilizadores do core
- cria clientes
- emite contratos
- regista pagamentos
- lê saldo, extrato e carteira
- mostra prioridade de cobrança por SLA
- dispara análise operacional por IA
- exibe estado real da API e do worker

### Instalação

```bash
pnpm install
cd CoreBank
cp .env.example .env
pnpm dev
```

### Configuração mínima

```env
VITE_API_URL=http://localhost:3000
```

### Serviços esperados

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:corebank
```

### Estrutura

- `src/App.tsx` - shell principal
- `src/lib/api.ts` - cliente HTTP da API
- `src/lib/types.ts` - tipos da dashboard
- `src/lib/format.ts` - formatação visual

### Objetivo comercial

Use o `CoreBank` para:

- demonstrar o produto a agências
- apresentar o fluxo completo de microcrédito
- validar operação com equipas de cobrança
- servir como base para um front-office real

### Governança

O `CoreBank` tem `package.json` próprio e não adiciona dependências da dashboard ao `package.json` do `creditflow-core`.

Ele participa do workspace apenas para que o `pnpm` instale e resolva as dependências corretamente. As dependências continuam isoladas em `CoreBank/package.json`.

## EN-US

### What it is

- a cockpit for origination, portfolio, collections, and AI-assisted operations
- a commercial demo interface backed by real API data
- an operations portal for agency, back-office, and collections teams

### What it does

- authenticates core users
- creates clients
- issues contracts
- records payments
- reads balances, statements, and portfolio data
- shows SLA-based collection priority
- triggers AI-assisted operational analysis
- displays real API and worker status

### Installation

```bash
pnpm install
cd CoreBank
cp .env.example .env
pnpm dev
```

### Minimum configuration

```env
VITE_API_URL=http://localhost:3000
```

### Expected services

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:corebank
```

### Structure

- `src/App.tsx` - main application shell
- `src/lib/api.ts` - API HTTP client
- `src/lib/types.ts` - dashboard types
- `src/lib/format.ts` - visual formatting helpers

### Commercial purpose

Use `CoreBank` to:

- demo the product to real agencies
- present the full microcredit workflow
- validate operations with collections teams
- serve as a base for a real front-office experience

### Governance

`CoreBank` has its own `package.json` and does not add dashboard dependencies to the `creditflow-core` root `package.json`.

It participates in the workspace only so `pnpm` can install and resolve dependencies correctly. Dashboard dependencies remain isolated in `CoreBank/package.json`.

## Documentation

- contribution: [CONTRIBUTING.md](CoreBank/CONTRIBUTING.md)
- security: [SECURITY.md](/CoreBank/SECURITY.md)
- code of conduct: [CODE_OF_CONDUCT.md](CoreBank/CODE_OF_CONDUCT.md)
- license: [LICENSE](/CoreBank/LICENSE)
