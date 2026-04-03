# Security Policy

## Escopo

Reporte falhas que afetem:

- autenticação
- autorização
- exposição de dados financeiros
- cálculo incorreto de contratos
- manipulação indevida de pagamentos
- execução indevida de reminders, worker ou automações

## Como reportar

Reporte em privado. Não publique exploit, credenciais, dumps ou passos de abuso em issues públicas.

Inclua:

- descrição do problema
- impacto esperado
- componentes afetados
- passos de reprodução
- evidência mínima necessária

## Prioridade

- crítica: acesso não autorizado, alteração de saldo, fuga de dados sensíveis
- alta: quebra de autorização, execução indevida de pagamentos, fraude operacional
- média: exposição limitada, falhas de validação, comportamento incorreto sem impacto financeiro imediato
- baixa: problemas informativos ou sem risco direto

## Princípios

- trate dados financeiros como sensíveis
- trate credenciais, tokens e chaves como segredos
- trate cálculo financeiro incorreto como incidente de segurança operacional

## Divulgação

Corrija primeiro. Divulgue depois. Documente impacto e mitigação.
