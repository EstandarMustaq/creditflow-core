import dayjs from 'dayjs';
import { evaluateLoanLedger, roundMoney } from './calculations.js';
import type { LedgerPayment, LoanScheduleResult } from './types.js';

export function getOverdueInstallments(
  schedule: LoanScheduleResult,
  payments: LedgerPayment[] = [],
  referenceDate = new Date()
) {
  return evaluateLoanLedger({ schedule, payments, referenceDate }).schedule.filter(
    (installment) => installment.status === 'OVERDUE'
  );
}

export function getInstallmentsAtRisk(
  schedule: LoanScheduleResult,
  payments: LedgerPayment[] = [],
  referenceDate = new Date()
) {
  return evaluateLoanLedger({ schedule, payments, referenceDate }).schedule.filter(
    (installment) => installment.status === 'AT_RISK'
  );
}

export function calculateRemainingBalance(
  schedule: LoanScheduleResult,
  payments: LedgerPayment[] = [],
  referenceDate = new Date()
) {
  return evaluateLoanLedger({ schedule, payments, referenceDate }).summary.outstandingBalance;
}

export function buildLoanReminderCandidates(
  schedule: LoanScheduleResult,
  payments: LedgerPayment[] = [],
  referenceDate = new Date(),
  overdueThresholdDays = 3
) {
  const ledger = evaluateLoanLedger({ schedule, payments, referenceDate });

  return ledger.schedule
    .filter((installment) => installment.status === 'AT_RISK' || installment.daysLate >= overdueThresholdDays)
    .map((installment) => ({
      installmentNumber: installment.installmentNumber,
      dueDate: installment.dueDate,
      daysLate: installment.daysLate,
      amountDue: roundMoney(installment.remainingToPay),
      reminderType: installment.status === 'AT_RISK' ? 'DUE_TODAY' : 'OVERDUE'
    }));
}

export function buildDueDate(referenceDate: string | Date, offsetMonths: number) {
  return dayjs(referenceDate).add(offsetMonths, 'month').format('YYYY-MM-DD');
}
