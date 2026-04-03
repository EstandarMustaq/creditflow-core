import cron from 'node-cron';
import { queueAndSendReminders } from '@creditflow-core/db';

async function runReminderSweep() {
  const result = await queueAndSendReminders({
    overdueThresholdDays: Number(process.env.REMINDER_THRESHOLD_DAYS ?? 3),
    dryRun: process.env.REMINDER_DRY_RUN === 'true'
  });

  console.log(`[worker] queued ${result.count} reminder(s)`);
}

export function startReminderJob() {
  cron.schedule('0 7 * * *', async () => {
    await runReminderSweep();
  });
}

export { runReminderSweep };
