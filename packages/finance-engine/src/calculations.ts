import dayjs from 'dayjs';
import type {
  InstallmentItem,
  InstallmentLedgerLine,
  LedgerPayment,
  LoanInput,
  LoanLedgerResult,
  LoanLedgerSummary,
  LoanScheduleResult,
  ReconcilePaymentsResult
} from './types.js';

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function annuityPayment(principal: number, monthlyRate: number, n: number) {
  if (monthlyRate === 0) {
    return principal / n;
  }

  return principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)));
}

function normalizeDate(input: string | Date) {
  return dayjs(input);
}

function normalizePaymentDate(input: string | Date) {
  return normalizeDate(input).startOf('day');
}

function determineInstallmentStatus(args: {
  dueDate: string;
  referenceDate: string;
  remainingToPay: number;
  paidAmount: number;
  daysLate: number;
}) {
  if (args.remainingToPay <= 0) {
    return 'PAID' as const;
  }

  if (args.daysLate > 0) {
    return 'OVERDUE' as const;
  }

  if (dayjs(args.dueDate).isSame(dayjs(args.referenceDate), 'day') && args.paidAmount === 0) {
    return 'AT_RISK' as const;
  }

  if (args.paidAmount > 0) {
    return 'PARTIAL' as const;
  }

  return 'PENDING' as const;
}

function determineContractStatus(summary: Omit<LoanLedgerSummary, 'status'>): LoanLedgerSummary['status'] {
  if (summary.outstandingBalance <= 0) {
    return 'PAID';
  }

  if (summary.installmentsOverdue > 0) {
    return 'DELINQUENT';
  }

  if (summary.installmentsAtRisk > 0) {
    return 'AT_RISK';
  }

  return 'ACTIVE';
}

export function calculateLoanSchedule(input: LoanInput): LoanScheduleResult {
  const monthlyInterestRate = input.annualInterestRate / 12 / 100;
  const installmentAmount = roundMoney(annuityPayment(input.principal, monthlyInterestRate, input.installmentCount));
  const schedule: InstallmentItem[] = [];
  let balance = input.principal;
  const start = normalizeDate(input.startDate);

  for (let i = 1; i <= input.installmentCount; i += 1) {
    const interest = roundMoney(balance * monthlyInterestRate);
    const principalPart = roundMoney(Math.min(balance, installmentAmount - interest));
    const payment = roundMoney(principalPart + interest);
    balance = roundMoney(Math.max(0, balance - principalPart));

    schedule.push({
      installmentNumber: i,
      dueDate: start.add(i - 1, 'month').format('YYYY-MM-DD'),
      payment,
      principal: principalPart,
      interest,
      balanceAfter: balance,
      isPaid: false,
      paidAmount: 0,
      daysLate: 0,
      lateFee: 0,
      remainingToPay: payment,
      status: 'PENDING'
    });
  }

  return {
    principal: roundMoney(input.principal),
    annualInterestRate: input.annualInterestRate,
    installmentCount: input.installmentCount,
    monthlyInterestRate,
    totalPayable: roundMoney(schedule.reduce((sum, item) => sum + item.payment, 0)),
    installmentAmount,
    lateFeeRateDaily: input.lateFeeRateDaily ?? 0,
    graceDays: input.graceDays ?? 0,
    currency: input.currency ?? 'MZN',
    schedule
  };
}

export function calculateLateFee(args: { overdueAmount: number; lateFeeRateDaily: number; daysLate: number }) {
  return roundMoney(args.overdueAmount * args.lateFeeRateDaily * args.daysLate);
}

export function evaluateLoanLedger(args: {
  schedule: LoanScheduleResult;
  payments?: LedgerPayment[];
  referenceDate?: string | Date;
}): LoanLedgerResult {
  const payments = [...(args.payments ?? [])]
    .filter((payment) => payment.amount > 0)
    .sort((left, right) => normalizePaymentDate(left.paidAt).valueOf() - normalizePaymentDate(right.paidAt).valueOf());

  const referenceDate = normalizeDate(args.referenceDate ?? new Date()).startOf('day');
  const baseSchedule = args.schedule.schedule.map((item) => ({ ...item }));

  let basePaymentPool = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const ledger: InstallmentLedgerLine[] = [];

  for (const installment of baseSchedule) {
    const baseDue = roundMoney(installment.principal + installment.interest);
    const basePaid = roundMoney(Math.min(baseDue, basePaymentPool));
    basePaymentPool = roundMoney(Math.max(0, basePaymentPool - basePaid));

    const principalCoverageRatio = baseDue === 0 ? 0 : installment.principal / baseDue;
    const principalPaid = roundMoney(basePaid * principalCoverageRatio);
    const interestPaid = roundMoney(basePaid - principalPaid);

    const outstandingPrincipal = roundMoney(Math.max(0, installment.principal - principalPaid));
    const outstandingInterest = roundMoney(Math.max(0, installment.interest - interestPaid));
    const outstandingBase = roundMoney(outstandingPrincipal + outstandingInterest);
    const rawDelay = referenceDate.diff(dayjs(installment.dueDate).startOf('day'), 'day');
    const daysLate = Math.max(0, rawDelay - args.schedule.graceDays);
    const lateFee = daysLate > 0
      ? calculateLateFee({
          overdueAmount: outstandingBase,
          lateFeeRateDaily: args.schedule.lateFeeRateDaily,
          daysLate
        })
      : 0;

    ledger.push({
      ...installment,
      paidAmount: basePaid,
      daysLate,
      lateFee,
      remainingToPay: roundMoney(outstandingBase + lateFee),
      isPaid: outstandingBase + lateFee <= 0,
      status: 'PENDING',
      outstandingPrincipal,
      outstandingInterest,
      outstandingBase,
      outstandingLateFee: lateFee,
      totalDue: roundMoney(baseDue + lateFee)
    });
  }

  let lateFeePaymentPool = basePaymentPool;

  for (const installment of ledger) {
    if (lateFeePaymentPool <= 0 || installment.outstandingLateFee <= 0) {
      installment.status = determineInstallmentStatus({
        dueDate: installment.dueDate,
        referenceDate: referenceDate.format('YYYY-MM-DD'),
        remainingToPay: installment.remainingToPay,
        paidAmount: installment.paidAmount,
        daysLate: installment.daysLate
      });
      installment.isPaid = installment.remainingToPay <= 0;
      continue;
    }

    const lateFeePaid = roundMoney(Math.min(installment.outstandingLateFee, lateFeePaymentPool));
    lateFeePaymentPool = roundMoney(Math.max(0, lateFeePaymentPool - lateFeePaid));
    installment.outstandingLateFee = roundMoney(Math.max(0, installment.outstandingLateFee - lateFeePaid));
    installment.remainingToPay = roundMoney(installment.outstandingBase + installment.outstandingLateFee);
    installment.paidAmount = roundMoney(installment.paidAmount + lateFeePaid);
    installment.isPaid = installment.remainingToPay <= 0;
    installment.status = determineInstallmentStatus({
      dueDate: installment.dueDate,
      referenceDate: referenceDate.format('YYYY-MM-DD'),
      remainingToPay: installment.remainingToPay,
      paidAmount: installment.paidAmount,
      daysLate: installment.daysLate
    });
  }

  const summaryBase = {
    referenceDate: referenceDate.format('YYYY-MM-DD'),
    totalContractValue: args.schedule.totalPayable,
    totalPaid: roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0)),
    totalLateFeesAccrued: roundMoney(ledger.reduce((sum, item) => sum + item.lateFee, 0)),
    principalOutstanding: roundMoney(ledger.reduce((sum, item) => sum + item.outstandingPrincipal, 0)),
    interestOutstanding: roundMoney(ledger.reduce((sum, item) => sum + item.outstandingInterest, 0)),
    lateFeeOutstanding: roundMoney(ledger.reduce((sum, item) => sum + item.outstandingLateFee, 0)),
    outstandingBalance: 0,
    remainingContractValue: 0,
    installmentsPaid: ledger.filter((item) => item.remainingToPay <= 0).length,
    installmentsOpen: ledger.filter((item) => item.remainingToPay > 0).length,
    installmentsOverdue: ledger.filter((item) => item.status === 'OVERDUE').length,
    installmentsAtRisk: ledger.filter((item) => item.status === 'AT_RISK').length,
    longestDelayDays: ledger.reduce((max, item) => Math.max(max, item.daysLate), 0)
  };

  const outstandingBalance = roundMoney(
    summaryBase.principalOutstanding + summaryBase.interestOutstanding + summaryBase.lateFeeOutstanding
  );
  const remainingContractValue = roundMoney(
    summaryBase.totalContractValue + summaryBase.totalLateFeesAccrued - summaryBase.totalPaid
  );

  const summary: LoanLedgerSummary = {
    ...summaryBase,
    outstandingBalance,
    remainingContractValue,
    status: determineContractStatus({
      ...summaryBase,
      outstandingBalance,
      remainingContractValue
    })
  };

  return { summary, schedule: ledger };
}

export function reconcilePayments(
  schedule: LoanScheduleResult,
  payments: LedgerPayment[],
  referenceDate?: string | Date
): ReconcilePaymentsResult {
  const ledger = evaluateLoanLedger({ schedule, payments, referenceDate });

  return {
    totalPaid: ledger.summary.totalPaid,
    outstanding: ledger.summary.outstandingBalance,
    installmentsPaid: ledger.summary.installmentsPaid,
    installmentsOpen: ledger.summary.installmentsOpen,
    schedule: ledger.schedule,
    summary: ledger.summary
  };
}

export function applyPayment(args: { loanId: string; amount: number; paidAt: Date; reference?: string }) {
  return {
    loanId: args.loanId,
    paidAmount: roundMoney(args.amount),
    paidAt: args.paidAt.toISOString(),
    reference: args.reference ?? null,
    status: 'RECORDED'
  };
}

export function summarizeLoanPosition(schedule: LoanScheduleResult, payments: LedgerPayment[] = [], referenceDate?: string | Date) {
  const ledger = evaluateLoanLedger({ schedule, payments, referenceDate });

  return {
    totalPayable: schedule.totalPayable,
    totalPaid: ledger.summary.totalPaid,
    remaining: ledger.summary.outstandingBalance,
    remainingContractValue: ledger.summary.remainingContractValue,
    installmentsLeft: ledger.summary.installmentsOpen,
    status: ledger.summary.status
  };
}

export function getPortfolioSnapshot(loans: LoanLedgerResult[]) {
  return loans.reduce(
    (acc, loan) => {
      acc.totalPrincipal = roundMoney(acc.totalPrincipal + loan.summary.totalContractValue);
      acc.totalOutstanding = roundMoney(acc.totalOutstanding + loan.summary.outstandingBalance);
      acc.totalLateFees = roundMoney(acc.totalLateFees + loan.summary.totalLateFeesAccrued);
      acc.totalContracts += 1;
      acc.totalInstallments += loan.schedule.length;
      return acc;
    },
    { totalPrincipal: 0, totalOutstanding: 0, totalLateFees: 0, totalContracts: 0, totalInstallments: 0 }
  );
}

export function buildRestructuredLoanInput(args: {
  currentLedger: LoanLedgerResult;
  annualInterestRate: number;
  installmentCount: number;
  startDate: string | Date;
  graceDays?: number;
  lateFeeRateDaily?: number;
  currency?: string;
}): LoanInput {
  return {
    principal: args.currentLedger.summary.outstandingBalance,
    annualInterestRate: args.annualInterestRate,
    installmentCount: args.installmentCount,
    startDate: args.startDate,
    graceDays: args.graceDays,
    lateFeeRateDaily: args.lateFeeRateDaily,
    currency: args.currency
  };
}
