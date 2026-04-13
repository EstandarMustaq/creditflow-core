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

export function buildReminderPrompt(input: {
  clientName: string;
  signerName: string;
  signerRole: string;
  installmentNumber: number;
  status: string;
  daysLate: number;
  remainingToPay: number;
}) {
  return `
Você escreve mensagens de cobrança para microcrédito.
Não invente cálculos. Use apenas os dados fornecidos.
Escreva uma mensagem curta, clara e formal, em português.
Escreva em nome de ${input.signerName}, com papel ${input.signerRole}.
Cliente: ${input.clientName}
Prestação: ${input.installmentNumber}
Estado: ${input.status}
Dias em atraso: ${input.daysLate}
Saldo da prestação: ${input.remainingToPay}
Termine exatamente com:
Está mensagem foi gerada automaticamente e assinada por ${input.signerName}, ${input.signerRole}, do Corebank.
Não use texto longo. Não use listas. Não use emojis.
`.trim();
}
