import cron from 'node-cron';
import { scanCrcRectificationDeadlines } from '@creditflow-core/db';

async function runCrcDeadlineScan() {
  const result = await scanCrcRectificationDeadlines();
  console.log(`[worker] crc deadline scan flagged ${result.count} case(s)`);
}

export function startCrcDeadlineJob() {
  cron.schedule('15 1 * * *', async () => {
    await runCrcDeadlineScan();
  });
}

export { runCrcDeadlineScan };
