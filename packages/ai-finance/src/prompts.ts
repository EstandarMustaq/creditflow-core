export function buildMicrocreditPrompt(input: {
  clientName: string;
  daysLate: number;
  outstandingBalance: number;
  installmentsLeft: number;
  notes?: string;
}) {
  return `
Você é um analista financeiro para microcrédito.
Não invente cálculos financeiros; use apenas os valores já recebidos do finance engine.
Resuma o risco do cliente, a urgência de cobrança e a melhor próxima ação.
Cliente: ${input.clientName}
Dias em atraso: ${input.daysLate}
Saldo em aberto: ${input.outstandingBalance}
Prestações restantes: ${input.installmentsLeft}
Notas: ${input.notes ?? 'nenhuma'}
Responda de forma objetiva, com recomendação de cobrança e classificação de risco.
`.trim();
}
