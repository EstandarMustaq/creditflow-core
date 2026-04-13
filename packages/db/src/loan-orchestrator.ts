import {
  applyPayment as buildPaymentReceipt,
  buildRestructuredLoanInput,
  calculateLoanSchedule,
  evaluateLoanLedger,
  getPortfolioSnapshot,
  roundMoney
} from '@creditflow-core/finance-engine';
import { generateReminderMessage } from '@creditflow-core/ai-finance';
import { buildClientKycProfile, isNuib, normalizeNuib } from '@creditflow-core/shared';
import { sendEmail } from '@creditflow-core/notifications';
import type { InstallmentState, LoanScheduleResult } from '@creditflow-core/finance-engine';
import { prisma } from './client.js';
import { decryptField, encryptField } from './crypto.js';

type AnyRecord = Record<string, unknown>;

function db() {
  return prisma as any;
}

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function serializeScheduleItem(item: AnyRecord) {
  return {
    installmentNumber: Number(item.installmentNumber),
    dueDate: String(item.dueDate),
    payment: Number(item.payment),
    principal: Number(item.principal),
    interest: Number(item.interest),
    balanceAfter: Number(item.balanceAfter),
    isPaid: Boolean(item.isPaid),
    paidAmount: Number(item.paidAmount),
    daysLate: Number(item.daysLate),
    lateFee: Number(item.lateFee),
    remainingToPay: Number(item.remainingToPay),
    status: String(item.status) as InstallmentState
  };
}

function mapLoanToSchedule(loan: AnyRecord) {
  const plan = loan.installmentPlan as AnyRecord | undefined;
  const payload = (plan?.schedulePayload as AnyRecord | undefined) ?? null;
  if (!payload) {
    throw new Error(`Loan ${String(loan.id)} does not have an installment plan`);
  }

  return {
    principal: Number(payload.principal),
    annualInterestRate: Number(payload.annualInterestRate),
    installmentCount: Number(payload.installmentCount),
    monthlyInterestRate: Number(payload.monthlyInterestRate),
    totalPayable: Number(payload.totalPayable),
    installmentAmount: Number(payload.installmentAmount),
    lateFeeRateDaily: Number(payload.lateFeeRateDaily ?? loan.lateFeeRateDaily ?? 0),
    graceDays: Number(payload.graceDays ?? loan.graceDays ?? 0),
    currency: String(payload.currency ?? loan.currency ?? 'MZN'),
    schedule: Array.isArray(payload.schedule) ? payload.schedule.map((item) => serializeScheduleItem(item as AnyRecord)) : []
  } satisfies LoanScheduleResult;
}

function mapPayments(payments: AnyRecord[] = []) {
  return payments.map((payment) => ({
    id: String(payment.id),
    amount: Number(payment.amount),
    paidAt: asDate(payment.paidAt),
    reference: payment.reference ? String(payment.reference) : undefined
  }));
}

function mapClientRecord(client: AnyRecord) {
  return {
    id: String(client.id),
    name: String(client.name),
    nuib: client.nuib ? String(client.nuib) : null,
    phone: decryptField(client.phone ? String(client.phone) : null),
    email: decryptField(client.email ? String(client.email) : null),
    nationalId: decryptField(client.nationalId ? String(client.nationalId) : null),
    address: decryptField(client.address ? String(client.address) : null),
    crcConsentAt: client.crcConsentAt ? asDate(client.crcConsentAt).toISOString() : null,
    kyc: {
      status: String(client.kycStatus ?? 'PENDING'),
      documentType: String(client.documentType ?? 'MOZ_ID'),
      documentAuthentic: Boolean(client.documentAuthentic),
      documentFormatValid: Boolean(client.documentFormatValid),
      documentCheckedAt: client.documentCheckedAt ? asDate(client.documentCheckedAt).toISOString() : null,
      phoneVerified: Boolean(client.phoneVerified),
      emailVerified: Boolean(client.emailVerified),
      addressVerified: Boolean(client.addressVerified),
    },
  };
}

async function appendImmutableRetentionLog(entry: {
  loanContractId?: string;
  eventType: string;
  retentionUntil?: Date | null;
  payload?: unknown;
}) {
  await db().immutableRetentionLog.create({
    data: {
      loanContractId: entry.loanContractId ?? null,
      eventType: entry.eventType,
      retentionUntil: entry.retentionUntil ?? null,
      payload: entry.payload ?? null,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildReminderEmailHtml(body: string, signatureNote: string) {
  return `
    <div style="background:#f8f4ea;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#101828;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(16,24,40,0.08);border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(16,24,40,0.08);">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(197,106,31,0.12);color:#c56a1f;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">
          CoreBank Reminder
        </div>
        <p style="margin:18px 0 0 0;font-size:15px;line-height:1.7;color:#101828;">
          ${escapeHtml(body)}
        </p>
        <div style="margin-top:20px;padding:14px 16px;border-left:4px solid #c56a1f;background:#fff4ec;color:#c56a1f;border-radius:12px;font-size:12px;line-height:1.6;">
          ${escapeHtml(signatureNote)}
        </div>
      </div>
    </div>
  `.trim();
}

function buildReminderSubject(input: {
  installmentNumber: number;
  status: string;
  daysLate: number;
}) {
  if (input.status === 'AT_RISK') {
    return `CoreBank | Prestação ${input.installmentNumber} vence hoje`;
  }

  return `CoreBank | Prestação ${input.installmentNumber} em atraso há ${input.daysLate} dia(s)`;
}

function buildReminderStoredMessage(body: string, signatureNote: string) {
  return `${body}\n\n[CoreBank]\n${signatureNote}`.trim();
}

async function getMostActivePortfolioUser() {
  const user = await db().user.findFirst({
    where: {
      role: {
        in: ['MANAGER', 'OFFICER'],
      },
    },
    orderBy: [
      { lastActiveAt: 'desc' },
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (!user) {
    return {
      name: 'Equipa CoreBank',
      roleLabel: 'gestor de carteira',
    };
  }

  return {
    name: String(user.name),
    roleLabel: String(user.role) === 'MANAGER' ? 'gestor de carteira' : 'oficial de crédito',
  };
}

async function writeAuditLog(entry: { entity: string; entityId?: string; action: string; payload?: unknown }) {
  await db().auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      action: entry.action,
      payload: entry.payload ?? null
    }
  });
}

async function upsertInstallmentPlan(args: {
  loanId: string;
  schedule: ReturnType<typeof calculateLoanSchedule>;
  source: string;
}) {
  const existing = await db().installmentPlan.findUnique({
    where: { loanContractId: args.loanId }
  });

  if (!existing) {
    await db().installmentPlan.create({
      data: {
        loanContractId: args.loanId,
        source: args.source,
        version: 1,
        schedulePayload: args.schedule
      }
    });
    return;
  }

  await db().installmentPlan.update({
    where: { loanContractId: args.loanId },
    data: {
      source: args.source,
      version: Number(existing.version) + 1,
      schedulePayload: args.schedule
    }
  });
}

async function replaceInstallments(args: {
  loanId: string;
  schedule: ReturnType<typeof calculateLoanSchedule>;
}) {
  await db().installment.deleteMany({
    where: { loanContractId: args.loanId }
  });

  if (!args.schedule.schedule.length) {
    return;
  }

  await db().installment.createMany({
    data: args.schedule.schedule.map((item) => ({
      loanContractId: args.loanId,
      installmentNo: item.installmentNumber,
      dueDate: new Date(item.dueDate),
      amount: item.payment,
      principal: item.principal,
      interest: item.interest,
      paidAmount: item.paidAmount,
      lateFee: item.lateFee,
      remainingToPay: item.remainingToPay,
      daysLate: item.daysLate,
      status: item.status
    }))
  });
}

export async function createClient(input: {
  name: string;
  nuib: string;
  phone: string;
  email: string;
  nationalId: string;
  address: string;
  crcConsentAt?: string;
}) {
  const nuib = normalizeNuib(input.nuib);
  if (!isNuib(nuib)) {
    throw new Error('Client NUIB is invalid.');
  }
  const kyc = buildClientKycProfile(input);
  if (kyc.metadata.kycStatus !== 'VERIFIED') {
    throw new Error('Client KYC validation failed.');
  }
  const client = await db().client.create({
    data: {
      name: input.name.trim(),
      nuib,
      phone: encryptField(kyc.phone),
      email: encryptField(kyc.email),
      nationalId: encryptField(kyc.nationalId),
      address: encryptField(kyc.address),
      kycStatus: kyc.metadata.kycStatus,
      documentType: kyc.metadata.documentType,
      documentAuthentic: kyc.metadata.documentAuthentic,
      documentFormatValid: kyc.metadata.documentFormatValid,
      documentCheckedAt: kyc.metadata.documentCheckedAt,
      phoneVerified: kyc.metadata.phoneVerified,
      emailVerified: kyc.metadata.emailVerified,
      addressVerified: kyc.metadata.addressVerified,
      crcConsentAt: input.crcConsentAt ? asDate(input.crcConsentAt) : null,
    },
  });
  await writeAuditLog({
    entity: 'CLIENT',
    entityId: String(client.id),
    action: 'CLIENT_CREATED',
    payload: {
      id: String(client.id),
      name: input.name.trim(),
      nuib,
      phone: kyc.phone,
      email: kyc.email,
      nationalId: kyc.nationalId,
      address: kyc.address,
      kyc: kyc.metadata,
      crcConsentAt: input.crcConsentAt ?? null,
    }
  });
  return mapClientRecord(client as AnyRecord);
}

export async function listClients() {
  const clients = await db().client.findMany({
    include: {
      loans: {
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (clients as AnyRecord[]).map((client) => ({
    ...mapClientRecord(client),
    loans: Array.isArray(client.loans) ? client.loans : [],
  }));
}

export async function createLoanContract(input: {
  clientId: string;
  imfId?: string;
  principal: number;
  annualInterestRate: number;
  installmentCount: number;
  startDate: string;
  graceDays?: number;
  lateFeeRateDaily?: number;
  currency?: string;
  counterparties?: Array<{
    role: 'AVALIST' | 'GUARANTOR';
    name: string;
    nuib: string;
    nationalId?: string;
    phone?: string;
  }>;
}) {
  const schedule = calculateLoanSchedule({
    ...input,
    graceDays: input.graceDays ?? 0,
    lateFeeRateDaily: input.lateFeeRateDaily ?? 0,
    currency: input.currency ?? 'MZN'
  });

  const client = await db().client.findUnique({
    where: { id: input.clientId },
  });

  if (!client) {
    throw new Error('Cliente não encontrado');
  }

  if (!client.nuib || !isNuib(String(client.nuib))) {
    throw new Error('Client must have a valid NUIB before loan creation.');
  }

  const loan = await db().loanContract.create({
    data: {
      imfId: input.imfId ?? 'imf_default',
      clientId: input.clientId,
      principal: input.principal,
      annualInterestRate: input.annualInterestRate,
      installmentCount: input.installmentCount,
      startDate: new Date(input.startDate),
      graceDays: input.graceDays ?? 0,
      lateFeeRateDaily: input.lateFeeRateDaily ?? 0,
      currency: input.currency ?? 'MZN',
      totalContractValue: schedule.totalPayable,
      outstandingBalance: schedule.totalPayable,
      totalPaid: 0,
      status: 'ACTIVE'
    }
  });

  await upsertInstallmentPlan({
    loanId: String(loan.id),
    schedule,
    source: 'INITIAL'
  });
  await replaceInstallments({
    loanId: String(loan.id),
    schedule
  });

  await db().loanParty.create({
    data: {
      loanContractId: String(loan.id),
      clientId: String(client.id),
      role: 'BORROWER',
      name: String(client.name),
      nuib: String(client.nuib),
      nationalId: client.nationalId ? String(client.nationalId) : null,
      phone: client.phone ? String(client.phone) : null,
    },
  });

  for (const party of input.counterparties ?? []) {
    const partyNuib = normalizeNuib(party.nuib);
    if (!isNuib(partyNuib)) {
      throw new Error(`Invalid NUIB for ${party.role.toLowerCase()}.`);
    }

    await db().loanParty.create({
      data: {
        loanContractId: String(loan.id),
        role: party.role,
        name: party.name.trim(),
        nuib: partyNuib,
        nationalId: party.nationalId ? encryptField(party.nationalId.trim().toUpperCase()) : null,
        phone: party.phone ? encryptField(party.phone) : null,
      },
    });
  }

  await writeAuditLog({
    entity: 'LOAN_CONTRACT',
    entityId: String(loan.id),
    action: 'LOAN_CREATED',
    payload: { input, schedule }
  });

  return getLoanBalance(String(loan.id));
}

async function loadLoan(loanId: string) {
  const loan = await db().loanContract.findUnique({
    where: { id: loanId },
    include: {
      client: true,
      imf: true,
      parties: true,
      installmentPlan: true,
      installments: {
        orderBy: { installmentNo: 'asc' }
      },
      payments: {
        orderBy: { paidAt: 'asc' }
      }
    }
  });

  if (!loan) {
    throw new Error('Contrato não encontrado');
  }

  return loan as AnyRecord;
}

export async function getLoanBalance(loanId: string, referenceDate?: string | Date) {
  const loan = await loadLoan(loanId);
  const schedule = mapLoanToSchedule(loan);
  const payments = mapPayments((loan.payments as AnyRecord[]) ?? []);
  const ledger = evaluateLoanLedger({ schedule, payments, referenceDate });

  return {
    loan: {
      id: String(loan.id),
      imfId: loan.imfId ? String(loan.imfId) : null,
      clientId: String(loan.clientId),
      status: String(loan.status),
      principal: Number(loan.principal),
      annualInterestRate: Number(loan.annualInterestRate),
      installmentCount: Number(loan.installmentCount),
      startDate: asDate(loan.startDate).toISOString(),
      graceDays: Number(loan.graceDays ?? 0),
      lateFeeRateDaily: Number(loan.lateFeeRateDaily ?? 0),
      currency: String(loan.currency ?? 'MZN')
    },
    imf: loan.imf
      ? {
          id: String((loan.imf as AnyRecord).id),
          code: String((loan.imf as AnyRecord).code),
          name: String((loan.imf as AnyRecord).name),
          nuib: String((loan.imf as AnyRecord).nuib),
        }
      : null,
    client: mapClientRecord(loan.client as AnyRecord),
    parties: Array.isArray(loan.parties)
      ? (loan.parties as AnyRecord[]).map((party) => ({
          id: String(party.id),
          role: String(party.role),
          name: String(party.name),
          nuib: String(party.nuib),
          nationalId: decryptField(party.nationalId ? String(party.nationalId) : null),
          phone: decryptField(party.phone ? String(party.phone) : null),
        }))
      : [],
    summary: ledger.summary,
    schedule: ledger.schedule,
    payments
  };
}

async function persistLedger(loanId: string, balance: Awaited<ReturnType<typeof getLoanBalance>>) {
  const summary = balance.summary;
  const isPaid = summary.status === 'PAID';
  const retentionUntil = isPaid ? new Date(new Date().setFullYear(new Date().getFullYear() + 10)) : null;

  await db().loanContract.update({
    where: { id: loanId },
    data: {
      status: summary.status,
      totalPaid: summary.totalPaid,
      outstandingBalance: summary.outstandingBalance,
      totalContractValue: summary.totalContractValue,
      longestDelayDays: summary.longestDelayDays,
      extinguishedAt: isPaid ? new Date() : null,
      crcReportedAt: isPaid ? new Date() : null,
      retentionUntil,
    }
  });

  if (isPaid) {
    await appendImmutableRetentionLog({
      loanContractId: loanId,
      eventType: 'LOAN_EXTINGUISHED',
      retentionUntil,
      payload: {
        status: summary.status,
        totalPaid: summary.totalPaid,
        outstandingBalance: summary.outstandingBalance,
      },
    });
  }

  for (const installment of balance.schedule) {
    await db().installment.updateMany({
      where: {
        loanContractId: loanId,
        installmentNo: installment.installmentNumber
      },
      data: {
        paidAmount: installment.paidAmount,
        lateFee: installment.lateFee,
        remainingToPay: installment.remainingToPay,
        daysLate: installment.daysLate,
        status: installment.status
      }
    });
  }
}

export async function recalculateLoanState(loanId: string, referenceDate?: string | Date) {
  const balance = await getLoanBalance(loanId, referenceDate);
  await persistLedger(loanId, balance);
  return balance;
}

export async function recordPayment(input: {
  loanId: string;
  amount: number;
  paidAt?: string;
  reference?: string;
}) {
  const payment = await db().payment.create({
    data: {
      loanContractId: input.loanId,
      amount: input.amount,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      reference: input.reference ?? null
    }
  });

  const balance = await recalculateLoanState(input.loanId);

  await writeAuditLog({
    entity: 'PAYMENT',
    entityId: String(payment.id),
    action: 'PAYMENT_RECORDED',
    payload: {
      payment,
      summary: balance.summary
    }
  });

  return {
    receipt: buildPaymentReceipt({
      loanId: input.loanId,
      amount: input.amount,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      reference: input.reference
    }),
    summary: balance.summary,
    schedule: balance.schedule
  };
}

export async function regenerateLoanSchedule(input: {
  loanId: string;
  annualInterestRate: number;
  installmentCount: number;
  startDate: string;
  graceDays?: number;
  lateFeeRateDaily?: number;
  reason?: string;
}) {
  const current = await getLoanBalance(input.loanId);
  const restructured = buildRestructuredLoanInput({
    currentLedger: {
      summary: current.summary,
      schedule: current.schedule
    },
    annualInterestRate: input.annualInterestRate,
    installmentCount: input.installmentCount,
    startDate: input.startDate,
    graceDays: input.graceDays ?? current.loan.graceDays,
    lateFeeRateDaily: input.lateFeeRateDaily ?? current.loan.lateFeeRateDaily,
    currency: current.loan.currency
  });
  const schedule = calculateLoanSchedule(restructured);

  await upsertInstallmentPlan({
    loanId: input.loanId,
    schedule,
    source: input.reason ?? 'RENEGOTIATION'
  });
  await replaceInstallments({
    loanId: input.loanId,
    schedule
  });
  await db().loanContract.update({
    where: { id: input.loanId },
    data: {
      status: 'RESTRUCTURED',
      annualInterestRate: input.annualInterestRate,
      installmentCount: input.installmentCount,
      startDate: new Date(input.startDate),
      graceDays: input.graceDays ?? current.loan.graceDays,
      lateFeeRateDaily: input.lateFeeRateDaily ?? current.loan.lateFeeRateDaily,
      principal: restructured.principal,
      totalContractValue: schedule.totalPayable,
      outstandingBalance: schedule.totalPayable
    }
  });

  await writeAuditLog({
    entity: 'LOAN_CONTRACT',
    entityId: input.loanId,
    action: 'SCHEDULE_REGENERATED',
    payload: {
      reason: input.reason ?? 'RENEGOTIATION',
      summaryBefore: current.summary,
      schedule
    }
  });

  return getLoanBalance(input.loanId);
}

export async function getClientStatement(clientId: string, referenceDate?: string | Date) {
  const client = await db().client.findUnique({
    where: { id: clientId },
    include: {
      loans: {
        orderBy: { createdAt: 'desc' },
        include: {
          client: true,
          installmentPlan: true,
          installments: { orderBy: { installmentNo: 'asc' } },
          payments: { orderBy: { paidAt: 'asc' } }
        }
      }
    }
  });

  if (!client) {
    throw new Error('Cliente não encontrado');
  }

  const loans = await Promise.all(
    ((client.loans as AnyRecord[]) ?? []).map((loan) => getLoanBalance(String(loan.id), referenceDate))
  );

  return {
    client: mapClientRecord(client as AnyRecord),
    loans,
    summary: {
      totalContracts: loans.length,
      totalOutstanding: roundMoney(loans.reduce((sum, loan) => sum + loan.summary.outstandingBalance, 0)),
      totalPaid: roundMoney(loans.reduce((sum, loan) => sum + loan.summary.totalPaid, 0)),
      overdueContracts: loans.filter((loan) => loan.summary.status === 'DELINQUENT').length
    }
  };
}

export async function queueAndSendReminders(input?: {
  referenceDate?: string | Date;
  overdueThresholdDays?: number;
  dryRun?: boolean;
}) {
  const referenceDate = input?.referenceDate ?? new Date();
  const activeUser = await getMostActivePortfolioUser();
  const loans = (await db().loanContract.findMany({
    include: {
      client: true,
      installmentPlan: true,
      installments: { orderBy: { installmentNo: 'asc' } },
      payments: { orderBy: { paidAt: 'asc' } }
    }
  })) as AnyRecord[];

  const created: AnyRecord[] = [];

  for (const loan of loans) {
    const balance = await recalculateLoanState(String(loan.id), referenceDate);
    const candidates = balance.schedule.filter(
      (installment) =>
        installment.status === 'AT_RISK' ||
        installment.daysLate >= Number(input?.overdueThresholdDays ?? 3)
    );

    for (const candidate of candidates) {
      const clientEmail = decryptField((loan.client as AnyRecord)?.email ? String((loan.client as AnyRecord).email) : null);
      const channel = clientEmail ? 'EMAIL' : 'INTERNAL';
      const reminderCopy = await generateReminderMessage({
        clientName: String((loan.client as AnyRecord)?.name ?? 'cliente'),
        signerName: activeUser.name,
        signerRole: activeUser.roleLabel,
        installmentNumber: candidate.installmentNumber,
        status: candidate.status,
        daysLate: candidate.daysLate,
        remainingToPay: candidate.remainingToPay,
      });
      const signatureNote = `informamos em nome de ${activeUser.name}, ${activeUser.roleLabel}, esta mensagem foi gerada automaticamente e assinada ${activeUser.name}, ${activeUser.roleLabel}, Corebank.`;
      const message = reminderCopy.message.replace(signatureNote, '').trim();
      const subject = buildReminderSubject({
        installmentNumber: candidate.installmentNumber,
        status: candidate.status,
        daysLate: candidate.daysLate,
      });
      const storedMessage = buildReminderStoredMessage(message, signatureNote);

      let reminderStatus = channel === 'EMAIL' ? 'PENDING' : 'PENDING';
      let sentAt: Date | null = null;

      if (!input?.dryRun && channel === 'EMAIL' && clientEmail && process.env.SMTP_HOST) {
        try {
          await sendEmail({
            to: clientEmail,
            subject,
            html: buildReminderEmailHtml(message, signatureNote)
          });
          reminderStatus = 'SENT';
          sentAt = new Date();
        } catch {
          reminderStatus = 'FAILED';
        }
      }

      const reminder = input?.dryRun
        ? {
            loanContractId: String(loan.id),
            channel,
            message: storedMessage,
            status: reminderStatus
          }
        : await db().reminder.create({
            data: {
              loanContractId: String(loan.id),
              channel,
              message: storedMessage,
              scheduledAt: new Date(),
              sentAt,
              status: reminderStatus,
              metadata: {
                installmentNumber: candidate.installmentNumber,
                daysLate: candidate.daysLate,
                referenceDate
              }
            }
          });

      created.push(reminder);
    }
  }

  await writeAuditLog({
    entity: 'REMINDER',
    action: 'REMINDER_SWEEP_EXECUTED',
    payload: {
      created: created.length,
      referenceDate
    }
  });

  return {
    count: created.length,
    items: created
  };
}

export async function getPortfolioOverview(referenceDate?: string | Date) {
  const loans = (await db().loanContract.findMany({
    include: {
      installmentPlan: true,
      installments: { orderBy: { installmentNo: 'asc' } },
      payments: { orderBy: { paidAt: 'asc' } }
    }
  })) as AnyRecord[];

  const balances = loans.map((loan) => {
    const schedule = mapLoanToSchedule(loan);
    const payments = mapPayments((loan.payments as AnyRecord[]) ?? []);
    return evaluateLoanLedger({ schedule, payments, referenceDate });
  });

  return getPortfolioSnapshot(balances);
}

export async function logAiEvent(input: {
  loanId?: string;
  eventType: string;
  provider: string;
  model: string;
  inputPayload?: unknown;
  outputPayload?: unknown;
}) {
  const event = await db().aiEvent.create({
    data: {
      loanContractId: input.loanId ?? null,
      eventType: input.eventType,
      provider: input.provider,
      model: input.model,
      inputPayload: input.inputPayload ?? null,
      outputPayload: input.outputPayload ?? null
    }
  });

  await writeAuditLog({
    entity: 'AI_EVENT',
    entityId: String(event.id),
    action: 'AI_ANALYSIS_EXECUTED',
    payload: input
  });

  return event;
}
