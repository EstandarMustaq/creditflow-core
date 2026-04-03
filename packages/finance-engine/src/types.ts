export type InstallmentState =
  | 'PENDING'
  | 'AT_RISK'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'PAID'
  | 'RESTRUCTURED';

export type ContractState =
  | 'ACTIVE'
  | 'AT_RISK'
  | 'DELINQUENT'
  | 'PAID'
  | 'RESTRUCTURED';

export interface LoanInput {
  principal: number;
  annualInterestRate: number;
  installmentCount: number;
  startDate: string | Date;
  graceDays?: number;
  lateFeeRateDaily?: number;
  currency?: string;
}

export interface InstallmentItem {
  installmentNumber: number;
  dueDate: string;
  payment: number;
  principal: number;
  interest: number;
  balanceAfter: number;
  isPaid: boolean;
  paidAmount: number;
  daysLate: number;
  lateFee: number;
  remainingToPay: number;
  status: InstallmentState;
}

export interface LoanScheduleResult {
  principal: number;
  annualInterestRate: number;
  installmentCount: number;
  monthlyInterestRate: number;
  totalPayable: number;
  installmentAmount: number;
  lateFeeRateDaily: number;
  graceDays: number;
  currency: string;
  schedule: InstallmentItem[];
}

export interface LedgerPayment {
  id?: string;
  amount: number;
  paidAt: string | Date;
  installmentNumber?: number;
  reference?: string;
}

export interface InstallmentLedgerLine extends InstallmentItem {
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingBase: number;
  outstandingLateFee: number;
  totalDue: number;
}

export interface LoanLedgerSummary {
  status: ContractState;
  referenceDate: string;
  totalContractValue: number;
  totalPaid: number;
  totalLateFeesAccrued: number;
  principalOutstanding: number;
  interestOutstanding: number;
  lateFeeOutstanding: number;
  outstandingBalance: number;
  remainingContractValue: number;
  installmentsPaid: number;
  installmentsOpen: number;
  installmentsOverdue: number;
  installmentsAtRisk: number;
  longestDelayDays: number;
}

export interface LoanLedgerResult {
  summary: LoanLedgerSummary;
  schedule: InstallmentLedgerLine[];
}

export interface ReconcilePaymentsResult {
  totalPaid: number;
  outstanding: number;
  installmentsPaid: number;
  installmentsOpen: number;
  schedule: InstallmentLedgerLine[];
  summary: LoanLedgerSummary;
}
