import assert from 'node:assert/strict';
import { calculateLoanSchedule, evaluateLoanLedger } from './index.js';

const schedule = calculateLoanSchedule({
  principal: 12000,
  annualInterestRate: 12,
  installmentCount: 6,
  startDate: '2026-01-05',
  graceDays: 0,
  lateFeeRateDaily: 0.01
});

assert.equal(schedule.schedule.length, 6);
assert.ok(schedule.totalPayable > 12000);

const ledger = evaluateLoanLedger({
  schedule,
  payments: [{ amount: schedule.installmentAmount / 2, paidAt: '2026-01-05' }],
  referenceDate: '2026-01-05'
});

assert.equal(ledger.schedule[0]?.status, 'PARTIAL');
assert.ok(ledger.summary.outstandingBalance > 0);

const overdue = evaluateLoanLedger({
  schedule,
  payments: [],
  referenceDate: '2026-02-10'
});

assert.ok(overdue.summary.installmentsOverdue >= 1);
assert.ok(overdue.summary.totalLateFeesAccrued > 0);

console.log('finance-engine self-test passed');
