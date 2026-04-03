# Contributing to CoreBank

## Objetivo

Contribua para uma dashboard comercial, curta e operacional.

## Faça

- use o `creditflow-core` como backend fonte de verdade
- mantenha a UI compacta e orientada a decisão
- prefira textos curtos, estados claros e ações objetivas
- reutilize endpoints existentes antes de propor backend novo
- valide com `pnpm --filter corebank-dashboard build`

## Não faça

- não replique regra financeira na interface
- não transforme a dashboard em playground genérico
- não use texto longo onde um estado visual resolve

## Fluxo

1. Mude a interface com foco em operação real.
2. Preserve coerência com a API e com o worker.
3. Valide build.
4. Atualize o `README.md` se a proposta do produto mudar.
