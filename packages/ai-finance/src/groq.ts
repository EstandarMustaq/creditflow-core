import { buildMicrocreditPrompt, buildReminderPrompt } from './prompts.js';

export async function analyzeMicrocreditCase(input: {
  clientName: string;
  daysLate: number;
  outstandingBalance: number;
  installmentsLeft: number;
  notes?: string;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const prompt = buildMicrocreditPrompt(input);

  if (!apiKey) {
    return {
      provider: 'groq',
      model,
      usedFallback: true,
      prompt,
      analysis: `Cliente ${input.clientName} com saldo em aberto de ${input.outstandingBalance} e ${input.daysLate} dias de atraso. Recomenda-se contacto imediato, validação da capacidade de pagamento e, se necessário, proposta de renegociação baseada no saldo já calculado pelo finance engine.`
    };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Você é um assistente financeiro para microcrédito.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq error: ${response.status} ${text}`);
  }

  const data: any = await response.json();
  return {
    provider: 'groq',
    model,
    usedFallback: false,
    analysis: data?.choices?.[0]?.message?.content ?? 'Sem resposta'
  };
}

export async function generateReminderMessage(input: {
  clientName: string;
  signerName: string;
  signerRole: string;
  installmentNumber: number;
  status: string;
  daysLate: number;
  remainingToPay: number;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const prompt = buildReminderPrompt(input);
  const signatureNote = `Está mensagem foi gerada automaticamente e assinada por ${input.signerName}, ${input.signerRole}, do Corebank.`;

  const fallback =
    input.status === 'AT_RISK'
      ? `Prezado(a) ${input.clientName}, a prestação ${input.installmentNumber} vence hoje. Por favor regularize o valor em aberto com brevidade. ${signatureNote}`
      : `Prezado(a) ${input.clientName}, a prestação ${input.installmentNumber} regista ${input.daysLate} dia(s) de atraso. Solicitamos a regularização do valor pendente com urgência. ${signatureNote}`;

  if (!apiKey) {
    return {
      provider: 'groq',
      model,
      usedFallback: true,
      prompt,
      message: fallback,
    };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Você é um assistente de comunicação financeira para microcrédito.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    return {
      provider: 'groq',
      model,
      usedFallback: true,
      prompt,
      message: fallback,
    };
  }

  const data: any = await response.json();
  return {
    provider: 'groq',
    model,
    usedFallback: false,
    message: data?.choices?.[0]?.message?.content?.trim() ?? fallback
  };
}
