import {
  applyPayment as buildPaymentReceipt,
  buildRestructuredLoanInput,
  calculateLoanSchedule,
  evaluateLoanLedger,
  getPortfolioSnapshot,
  roundMoney
} from '@creditflow-core/finance-engine';
import { sendEmail } from '@creditflow-core/notifications';
import type { InstallmentState, LoanScheduleResult } from '@creditflow-core/finance-engine';
import { prisma } from './client.js';

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
  phone: string;
  email?: string;
  nationalId?: string;
  address?: string;
}) {
  const client = await db().client.create({ data: input });
  await writeAuditLog({
    entity: 'CLIENT',
    entityId: String(client.id),
    action: 'CLIENT_CREATED',
    payload: client
  });
  return client;
}

export async function listClients() {
  return db().client.findMany({
    include: {
      loans: {
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createLoanContract(input: {
  clientId: string;
  principal: number;
  annualInterestRate: number;
  installmentCount: number;
  startDate: string;
  graceDays?: number;
  lateFeeRateDaily?: number;
  currency?: string;
}) {
  const schedule = calculateLoanSchedule({
    ...input,
    graceDays: input.graceDays ?? 0,
    lateFeeRateDaily: input.lateFeeRateDaily ?? 0,
    currency: input.currency ?? 'MZN'
  });

  const loan = await db().loanContract.create({
    data: {
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
    client: loan.client,
    summary: ledger.summary,
    schedule: ledger.schedule,
    payments
  };
}

async function persistLedger(loanId: string, balance: Awaited<ReturnType<typeof getLoanBalance>>) {
  const summary = balance.summary;

  await db().loanContract.update({
    where: { id: loanId },
    data: {
      status: summary.status,
      totalPaid: summary.totalPaid,
      outstandingBalance: summary.outstandingBalance,
      totalContractValue: summary.totalContractValue,
      longestDelayDays: summary.longestDelayDays
    }
  });

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
    client: {
      id: String(client.id),
      name: String(client.name),
      phone: String(client.phone),
      email: client.email ? String(client.email) : null,
      nationalId: client.nationalId ? String(client.nationalId) : null,
      address: client.address ? String(client.address) : null
    },
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
      const channel = (loan.client as AnyRecord)?.email ? 'EMAIL' : 'INTERNAL';
      const message =
        candidate.status === 'AT_RISK'
          ? `Prestação ${candidate.installmentNumber} vence hoje. Valor em risco: ${candidate.remainingToPay}.`
          : `Prestação ${candidate.installmentNumber} em atraso há ${candidate.daysLate} dia(s). Saldo: ${candidate.remainingToPay}.`;

      let reminderStatus = channel === 'EMAIL' ? 'PENDING' : 'PENDING';
      let sentAt: Date | null = null;

      if (!input?.dryRun && channel === 'EMAIL' && (loan.client as AnyRecord)?.email && process.env.SMTP_HOST) {
        try {
          await sendEmail({
            to: String((loan.client as AnyRecord).email),
            subject:
              candidate.status === 'AT_RISK'
                ? 'Prestação vence hoje'
                : `Prestação em atraso há ${candidate.daysLate} dia(s)`,
            html: `<p>${message}</p>`
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
            message,
            status: reminderStatus
          }
        : await db().reminder.create({
            data: {
              loanContractId: String(loan.id),
              channel,
              message,
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
