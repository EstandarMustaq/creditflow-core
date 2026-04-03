import 'dotenv/config';
import { startReminderJob } from './jobs/reminders.js';
import { startRecalculationJob } from './jobs/recalculate.js';
import { writeWorkerHeartbeat } from '@creditflow-core/shared';
import { ensureCoreSchema } from '@creditflow-core/db';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to start the worker.');
}

await ensureCoreSchema();
console.log('Creditflow worker started');
await writeWorkerHeartbeat('worker:start');
setInterval(() => {
  void writeWorkerHeartbeat('worker:heartbeat');
}, 30_000);
startReminderJob();
startRecalculationJob();
