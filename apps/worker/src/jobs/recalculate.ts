import cron from 'node-cron';
import { prisma, recalculateLoanState } from '@creditflow-core/db';

async function recalculateAllContracts() {
  const loans = await (prisma as any).loanContract.findMany({
    select: { id: true }
  });

  for (const loan of loans as Array<{ id: string }>) {
    await recalculateLoanState(loan.id);
  }

  console.log(`[worker] recalculated ${loans.length} contract(s)`);
}

export function startRecalculationJob() {
  cron.schedule('0 1 * * *', async () => {
    await recalculateAllContracts();
  });
}

export { recalculateAllContracts };
