# Contributing

## Objetivo

Contribua com mudanças pequenas, verificáveis e alinhadas com o domínio de microcrédito.

## Faça

- leia o `README.md` antes de alterar arquitetura ou fluxo
- mantenha cálculo financeiro dentro do `packages/finance-engine`
- trate a API como fonte de verdade para estados de contrato, carteira e cobrança
- escreva código claro, pequeno e auditável
- use nomes consistentes com o domínio financeiro
- valide com `pnpm typecheck`
- valide interfaces novas com `pnpm --filter corebank-dashboard build` quando tocar no `CoreBank`

## Não faça

- não coloque cálculo monetário na camada de IA
- não duplique regra financeira entre API, worker e dashboard
- não introduza dependências amplas sem necessidade
- não quebre compatibilidade de endpoints sem documentar

## Fluxo recomendado

1. Abra uma branch curta.
2. Faça uma mudança por intenção.
3. Valide localmente.
4. Atualize a documentação quando necessário.
5. Envie para revisão.

## Padrões de mudança

- backend: preserve determinismo, auditoria e rastreabilidade
- worker: preserve idempotência e recorrência segura
- dashboard: privilegie texto curto, leitura rápida e estados claros
- documentação: escreva de forma direta e operacional

## Checklist antes de enviar

- `pnpm typecheck`
- `pnpm --filter corebank-dashboard build` se houver alteração no `CoreBank`
- revisão de impacto em `README.md`, `SECURITY.md` ou `CONTRIBUTING.md` quando aplicável
